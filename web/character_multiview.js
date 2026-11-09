import { app } from "../../scripts/app.js";
import { PLUGIN_ID, settingsViews, normalizeSettings, makeLayout, createApplication, normalizePanelRect, snapPanelRect, findFreePanelRect, stripMultiviewBlocks } from "./character_multiview_core.js";
import {createLibrary,restoreLayout} from './character_multiview_library.js';
import {mannequinMarkup,whiteModelPNG,panelViewBox} from './character_multiview_whitemodel.js';

const library=createLibrary({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
let cleanupTimer;

const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const figure=view=>view.group==="detail"?'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 49V28h11v12h25v12H13z" fill="#aebbc1"/></svg>':'<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="13" r="8" fill="#aebbc1"/><path d="M23 24h18l5 18-7 2-3-13v15l5 16h-8l-2-13-2 13h-8l5-16V31l-3 13-7-2z" fill="#aebbc1"/></svg>';

export function openCharacterMultiview(options={}) {
    const draft=normalizeSettings(options.settings);
    let width=Number(options.width)||1024,height=Number(options.height)||1024;
    const resolutions=Array.isArray(options.resolutionOptions)&&options.resolutionOptions.length?options.resolutionOptions:[{width,height,label:`${width} × ${height}`}];
    let resolution=resolutions.find(item=>item.width===width&&item.height===height)||{width,height};
    let generationMode=options.generationMode==='图生图'?'图生图':'文生图';
    let basePrompt=String(options.prompt||'');
    makeLayout(draft,width,height);
    if(!document.querySelector('link[data-character-multiview-style]')){
        const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./character_multiview.css',import.meta.url).href;style.dataset.characterMultiviewStyle='1';document.head.appendChild(style);
    }
    return new Promise(resolve=>{
        const root=document.createElement('div');root.className='xcmv-overlay';
        root.innerHTML=`<section class="xcmv-dialog" role="dialog" aria-modal="true" aria-label="角色多视图设置">
        <header><div><b>角色多视图设置</b><small>ComfyUI-Character-Multiview-Workbench</small></div><button data-close aria-label="关闭角色多视图设置">×</button></header>
        <main><div class="xcmv-mode" aria-label="生成模式"><button type="button" data-mode="文生图">文生图</button><button type="button" data-mode="图生图">图生图</button><small data-mode-hint></small><div class="xcmv-library-buttons"><button data-library="favorites">收藏</button><button data-library="history">历史</button></div></div>
        <section data-library-pane class="xcmv-library" hidden><header><b data-library-title></b><label data-expiry-label><input type="checkbox" data-auto-delete>24小时自动删除历史</label></header><small>选中布局图后点应用，直接写入外面的提示词。沿用当前角色描述、生成模式和画布尺寸；收藏不受自动清理影响。</small><div data-library-list></div><footer><button data-apply-record disabled>应用</button></footer></section>
        <div class="xcmv-section-head"><b>选择视图</b><span data-count></span></div>
        <div class="xcmv-views" data-views></div>
        <div data-custom-editor hidden><label>自定义名称<input data-custom-name placeholder="例如：耳环细节、项链、武器"></label><button data-custom-confirm>添加</button><button data-custom-cancel>取消</button></div>
        <div class="xcmv-options"><label>分辨率选择<select data-resolution>${resolutions.map((item,index)=>`<option value="${index}" ${item.width===width&&item.height===height?'selected':''}>${esc(item.label||`${item.width} × ${item.height}`)}</option>`).join('')}</select></label><label>服装展示<select data-clothing><option value="worn">穿着展示</option><option value="garments">仅服装</option></select></label></div>
        <p class="xcmv-size">输出尺寸：<b data-canvas-size>${width} × ${height}</b>，仅在主动选择分辨率时改变；布局按比例保留。</p>
        <div class="xcmv-workspace"><div class="xcmv-settings"><nav><button data-tab="layout" class="active">布局</button><button data-tab="parts">分区提示词</button><button data-tab="style">风格</button><button data-favorite-current>收藏</button><label><input type="checkbox" data-headless>全身去头</label><button data-clear-selection>清空勾选</button></nav>
        <section data-pane="layout"><div data-layout class="xcmv-layout"></div><small>拖动视图块移动，拖右下角缩放；靠近画布或其他块边缘自动吸附。画布尺寸固定。</small><small>布局仅为生成模型提供示意和约束，不是像素级拼图或真实 3D 重建。</small><div class="xcmv-canvas-actions"><button data-apply-layout>应用</button></div></section>
        <section data-pane="parts" hidden><div data-parts class="xcmv-parts"></div></section>
        <section data-pane="style" hidden><label>统一风格<textarea data-style placeholder="填写这张角色设定图需要保持的统一画风、材质和光照"></textarea></label></section>
        </div><label class="xcmv-prompt">提示词约束<textarea readonly data-prompt-preview aria-label="设置后的提示词约束" placeholder="排好布局后，点击画布下方的应用生成提示词约束"></textarea></label></div>
        <p data-error role="alert"></p></main><footer><button data-cancel>取消</button><button data-apply class="primary">应用到提示词</button></footer></section>`;
        const q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)];
        let closed=false,drag=null,libraryTab='',prepared=null,selectedRecord='';
        const finish=value=>{if(closed)return;closed=true;clearInterval(expiryTimer);document.removeEventListener('keydown',onKey);root.remove();resolve(value);};
        const onKey=event=>{if(event.key==='Escape')finish(null);};
        function preview(){
            qa('[data-mode]').forEach(button=>{const active=button.dataset.mode===generationMode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
            q('[data-mode-hint]').textContent=generationMode==='图生图'?`应用时传入白模布局图；角色参考图 ${Number(options.referenceImageCount)||0} 张。白模只约束布局，不代表人物身份。`:'仅使用提示词约束，不传入白模布局图。';
            const layout=makeLayout(draft,width,height);
            for(const p of layout.panels)draft.layout[p.id]={x:p.x/width,y:p.y/height,width:p.width/width,height:p.height/height};
            const handle=Math.min(width,height)*.035;
            q('[data-layout]').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="角色视图布局编辑画布">${layout.panels.map(p=>`<g data-panel="${p.id}"><rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="4"/>${generationMode==='图生图'?`<svg x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" viewBox="0 0 200 300" pointer-events="none">${mannequinMarkup(p,'preview-'+p.id)}</svg>`:''}<text x="${p.x+p.width/2}" y="${generationMode==='图生图'?p.y+p.height*.95:p.y+p.height/2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(p.width/7,p.height/8,Math.min(width,height)*.027)}">${esc(p.label)}</text><rect class="xcmv-resize" data-resize x="${p.x+p.width-Math.min(handle,p.width/3)}" y="${p.y+p.height-Math.min(handle,p.height/3)}" width="${Math.min(handle,p.width/3)}" height="${Math.min(handle,p.height/3)}"/></g>`).join('')}</svg>`;
            for(const p of layout.panels)q(`[data-panel="${p.id}"] > svg`)?.setAttribute('viewBox',panelViewBox(p));
            prepared=null;q('[data-prompt-preview]').value='';
            q('[data-apply-layout]').disabled=!draft.selected.length;
            q('[data-apply]').disabled=true;
            q('[data-favorite-current]').disabled=!draft.selected.length;
        }
        const canvas=q('[data-layout]');
        const canvasPoint=event=>{
            const svg=canvas.querySelector('svg'),matrix=svg?.getScreenCTM();
            if(!matrix)return null;
            const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
            return {x:point.x/width,y:point.y/height,tolerance:{x:8/(matrix.a*width),y:8/(matrix.d*height)}};
        };
        canvas.onpointerdown=event=>{
            const panel=event.target.closest('[data-panel]'),point=canvasPoint(event);
            if(event.button!==0||!panel||!point)return;
            drag={pointerId:event.pointerId,id:panel.dataset.panel,start:point,rect:{...draft.layout[panel.dataset.panel]},resize:event.target.hasAttribute('data-resize')};
            canvas.setPointerCapture(event.pointerId);event.preventDefault();
        };
        canvas.onpointermove=event=>{
            if(!drag||drag.pointerId!==event.pointerId)return;
            const point=canvasPoint(event);if(!point)return;
            const dx=point.x-drag.start.x,dy=point.y-drag.start.y,r=drag.rect;
            const raw=drag.resize?{...r,width:Math.max(.01,Math.min(1-r.x,r.width+dx)),height:Math.max(.01,Math.min(1-r.y,r.height+dy))}:{...r,x:r.x+dx,y:r.y+dy};
            const others=draft.selected.filter(id=>id!==drag.id).map(id=>draft.layout[id]).filter(Boolean);
            draft.layout[drag.id]=snapPanelRect(normalizePanelRect(raw),others,point.tolerance,drag.resize);
            preview();event.preventDefault();
        };
        const endDrag=event=>{if(drag?.pointerId!==event.pointerId)return;drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);};
        canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=endDrag;
        function render(){
            const views=settingsViews(draft);
            q('[data-views]').innerHTML=views.map(v=>`<button type="button" data-view="${v.id}" aria-pressed="false">${figure(v)}<span>${esc(v.label)}</span><i>✓</i></button>`).join('')+'<button type="button" data-add-custom>＋自定义</button>';
            qa('[data-view]').forEach(button=>button.onclick=()=>{const id=button.dataset.view;setSelection(draft.selected.includes(id)?draft.selected.filter(x=>x!==id):[...draft.selected,id]);});
            q('[data-add-custom]').onclick=()=>{q('[data-custom-editor]').hidden=false;q('[data-custom-name]').focus();};
            qa('[data-view]').forEach(button=>{const active=draft.selected.includes(button.dataset.view);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
            q('[data-count]').textContent=`已选择 ${draft.selected.length} / ${views.length}`;
            q('[data-parts]').innerHTML=views.filter(v=>draft.selected.includes(v.id)).map(v=>`<label>${esc(v.label)}<textarea data-part="${v.id}" placeholder="只补充这个分区的要求；留空沿用原角色描述">${esc(draft.partPrompts[v.id])}</textarea></label>`).join('');
            qa('[data-part]').forEach(input=>input.oninput=()=>{draft.partPrompts[input.dataset.part]=input.value;preview();});
            preview();
        }
        function setSelection(next){
            draft.selected=draft.selected.filter(id=>next.includes(id));
            for(const id of next){
                if(draft.selected.includes(id))continue;
                const rect=findFreePanelRect(draft,id);
                if(!rect){q('[data-error]').textContent='画布没有可用空位，请先调整已有视图块或取消部分勾选。';break;}
                draft.layout[id]=rect;draft.selected.push(id);
            }
            render();
        }
        q('[data-custom-cancel]').onclick=()=>{q('[data-custom-editor]').hidden=true;};
        q('[data-custom-confirm]').onclick=()=>{
            const label=q('[data-custom-name]').value.trim();if(!label){q('[data-error]').textContent='请填写自定义名称。';return;}
            const id='custom_'+crypto.randomUUID();
            draft.customViews.push({id,label,group:'custom'});draft.partPrompts[id]='';
            setSelection([...draft.selected,id]);q('[data-custom-editor]').hidden=true;q('[data-custom-name]').value='';
        };
        q('[data-headless]').checked=draft.headless;
        q('[data-headless]').onchange=event=>{draft.headless=event.target.checked;preview();};
        q('[data-clear-selection]').onclick=()=>{draft.selected=[];render();};
        qa('[data-mode]').forEach(button=>button.onclick=()=>{generationMode=button.dataset.mode;preview();});
        q('[data-resolution]').onchange=event=>{const selected=resolutions[Number(event.target.value)];if(!selected)return;resolution=selected;width=selected.width;height=selected.height;q('[data-canvas-size]').textContent=`${width} × ${height}`;preview();};
        q('[data-clothing]').value=draft.clothingMode;q('[data-clothing]').onchange=event=>{draft.clothingMode=event.target.value;preview();};
        q('[data-style]').value=draft.stylePrompt;q('[data-style]').oninput=event=>{draft.stylePrompt=event.target.value;preview();};
        qa('[data-tab]').forEach(button=>button.onclick=()=>{qa('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));qa('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==button.dataset.tab);});
        q('[data-close]').onclick=q('[data-cancel]').onclick=()=>finish(null);
        const application=()=>({generationMode,resolution:{...resolution},...createApplication(basePrompt,draft,width,height,generationMode)});
        const withWhiteModel=async result=>({...result,...(result.generationMode==='图生图'?{whiteModelImage:await whiteModelPNG(result.layout)}:{})});
        q('[data-apply-layout]').onclick=()=>{try{prepared=application();q('[data-prompt-preview]').value=prepared.prompt;q('[data-apply]').disabled=false;q('[data-error]').textContent='';try{library.add(draft);}catch(error){showError(error);}}catch(error){showError(error);}};
        const showError=error=>{q('[data-error]').textContent=String(error.message||error);};
        function renderLibrary(){
            try{
                const data=library.read(),records=data[libraryTab]||[];
                q('[data-library-pane]').hidden=!libraryTab;
                q('[data-library-title]').textContent=libraryTab==='favorites'?'收藏':'历史';
                q('[data-expiry-label]').hidden=libraryTab!=='history';q('[data-auto-delete]').checked=data.autoDelete;
                q('[data-library-list]').innerHTML=records.length?records.map(record=>{
                    const layout=makeLayout(record,width,height);
                    return `<article><button class="xcmv-layout-card ${selectedRecord===record.id?'active':''}" data-load-record="${esc(record.id)}" aria-label="选择布局：${esc(record.title)}" aria-pressed="${selectedRecord===record.id}"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(record.title)}">${layout.panels.map(p=>`<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}"/>`).join('')}</svg></button><button data-favorite-record="${esc(record.id)}" aria-label="${data.favorites.some(item=>item.id===record.id)?'取消收藏':'收藏'}此布局">${data.favorites.some(item=>item.id===record.id)?'★':'☆'}</button></article>`;
                }).join(''):'<p>暂无布局</p>';
                q('[data-apply-record]').disabled=!records.some(record=>record.id===selectedRecord);
                qa('[data-load-record]').forEach(button=>button.onclick=()=>{
                    selectedRecord=button.dataset.loadRecord;renderLibrary();
                });
                qa('[data-favorite-record]').forEach(button=>button.onclick=()=>{try{const record=records.find(item=>item.id===button.dataset.favoriteRecord);if(!record)return;if(data.favorites.some(item=>item.id===record.id))library.unfavorite(record.id);else library.favorite(record);renderLibrary();}catch(error){showError(error);}});
            }catch(error){showError(error);}
        }
        qa('[data-library]').forEach(button=>button.onclick=()=>{libraryTab=libraryTab===button.dataset.library?'':button.dataset.library;selectedRecord='';renderLibrary();});
        q('[data-apply-record]').onclick=async()=>{try{
            const record=(library.read()[libraryTab]||[]).find(item=>item.id===selectedRecord);if(!record)return;
            const settings=restoreLayout(draft,record);
            const result={contextId:String(options.contextId||''),generationMode,resolution:{...resolution},...createApplication(basePrompt,settings,width,height,generationMode)};
            try{library.add(settings);}catch(error){window.alert('本次布局历史保存失败，仍会应用：'+String(error.message||error));}
            q('[data-apply-record]').disabled=true;finish(await withWhiteModel(result));
        }catch(error){q('[data-apply-record]').disabled=false;showError(error);}};
        q('[data-auto-delete]').onchange=()=>{try{library.setAutoDelete(q('[data-auto-delete]').checked);renderLibrary();}catch(error){showError(error);}};
        q('[data-favorite-current]').onclick=()=>{try{if(!draft.selected.length)return;library.add(draft,true);q('[data-error]').textContent='当前布局已收藏。';}catch(error){showError(error);}};
        q('[data-apply]').onclick=async()=>{try{if(!prepared)return;q('[data-apply]').disabled=true;finish(await withWhiteModel({contextId:String(options.contextId||''),...prepared}));}catch(error){q('[data-apply]').disabled=false;showError(error);}};
        const expiryTimer=setInterval(()=>{if(libraryTab)renderLibrary();else try{library.read();}catch(error){showError(error);}},60000);
        document.body.appendChild(root);document.addEventListener('keydown',onKey);render();renderLibrary();q('[data-close]').focus();
    });
}

app.registerExtension({name:"ComfyUI.CharacterMultiviewWorkbench",setup(){
    globalThis.ComfyUICharacterMultiview=Object.freeze({apiVersion:1,pluginId:PLUGIN_ID,open:openCharacterMultiview,createApplication,stripMultiviewBlocks,createWhiteModelImage:(settings,width,height)=>whiteModelPNG(makeLayout(settings,width,height))});
    if(!cleanupTimer)cleanupTimer=setInterval(()=>{try{library.read();}catch{}},60000);
}});
