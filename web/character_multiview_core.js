export const PLUGIN_ID = "comfyui-character-multiview-workbench";
export const VIEWS = Object.freeze([
    ["portrait","正面头像","head"],["left_portrait","左侧头像","head"],
    ["right_portrait","右侧头像","head"],["left_34","左四分之三头像","head"],
    ["right_34","右四分之三头像","head"],["rear_portrait","背面头像","head"],
    ["front","正面全身","body"],["left_side","左侧全身","body"],["back","背面全身","body"],
    ["clothing_front","服装正面","body"],["clothing_back","服装背面","body"],
    ["hands","双手细节","detail"],["footwear","鞋靴细节","detail"],
].map(([id,label,group]) => Object.freeze({id,label,group})));
export const PRESETS = Object.freeze({all:VIEWS.map(v=>v.id),three:["front","left_side","back"],heads:VIEWS.filter(v=>v.group==="head").map(v=>v.id),details:["clothing_front","clothing_back","hands","footwear"]});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const FULL_BODY_IDS=Object.freeze(['front','left_side','back']);
export function settingsViews(value={}) {
    const custom=Array.isArray(value.customViews)?value.customViews:[];
    const seen=new Set(VIEWS.map(v=>v.id));
    return [...VIEWS,...custom.filter(v=>{
        if(!v||!/^custom_[a-zA-Z0-9_-]+$/.test(v.id)||!String(v.label||'').trim()||seen.has(v.id))return false;
        seen.add(v.id);return true;
    }).map(v=>({id:v.id,label:String(v.label).trim(),group:'custom'}))];
}
export function normalizePanelRect(value) {
    if(!value||!['x','y','width','height'].every(key=>Number.isFinite(value[key])))return null;
    const width=clamp(value.width,.01,1),height=clamp(value.height,.01,1);
    return {x:clamp(value.x,0,1-width),y:clamp(value.y,0,1-height),width,height};
}

export function snapPanelRect(value,others,tolerance={x:.01,y:.01},resize=false) {
    const rect=normalizePanelRect(value);
    if(!rect)return null;
    const nearest=(edges,targets,limit)=>{
        let delta=0,best=limit;
        for(const edge of edges)for(const target of targets){const d=target-edge;if(Math.abs(d)<=best){delta=d;best=Math.abs(d);}}
        return delta;
    };
    const tx=[0,1,...others.flatMap(p=>[p.x,p.x+p.width])],ty=[0,1,...others.flatMap(p=>[p.y,p.y+p.height])];
    const dx=nearest(resize?[rect.x+rect.width]:[rect.x,rect.x+rect.width],tx,tolerance.x);
    const dy=nearest(resize?[rect.y+rect.height]:[rect.y,rect.y+rect.height],ty,tolerance.y);
    return normalizePanelRect(resize?{...rect,width:rect.width+dx,height:rect.height+dy}:{...rect,x:rect.x+dx,y:rect.y+dy});
}

export function normalizeSettings(value={}) {
    const views=settingsViews(value);
    const selected=Array.isArray(value.selected)?views.filter(v=>value.selected.includes(v.id)).map(v=>v.id):[...PRESETS.all];
    return {selected,customViews:views.filter(v=>v.group==='custom'),headless:value.headless===true,clothingMode:value.clothingMode==="garments"?"garments":"worn",
        stylePrompt:String(value.stylePrompt||""),
        partPrompts:Object.fromEntries(views.map(v=>[v.id,String(value.partPrompts?.[v.id]||"")])),
        layout:Object.fromEntries(views.map(v=>[v.id,normalizePanelRect(value.layout?.[v.id])]).filter(([,rect])=>rect)),
        appliedBlock:String(value.appliedBlock||"")};
}

export function makeLayout(settings,width,height) {
    const config=normalizeSettings(settings),w=Number(width),h=Number(height);
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)throw new Error("输出尺寸无效");
    const views=settingsViews(config).filter(v=>config.selected.includes(v.id));
    const margin=Math.min(w,h)*.025,gap=Math.min(w,h)*.012;
    const cw=views.length?(w-2*margin-gap*Math.max(0,views.length-1))/views.length:0;
    const panels=views.map((view,i)=>{
        const rect=config.layout[view.id];
        return {...view,headless:config.headless&&FULL_BODY_IDS.includes(view.id),...(rect?{x:rect.x*w,y:rect.y*h,width:rect.width*w,height:rect.height*h}:{x:margin+i*(cw+gap),y:margin,width:cw,height:h-2*margin})};
    });
    return {width:w,height:h,panels};
}

export function findFreePanelRect(settings,id) {
    const config=normalizeSettings(settings),desired=config.layout[id]||{width:.22,height:.4};
    const occupied=makeLayout({...config,selected:config.selected.filter(key=>key!==id)},1,1).panels;
    let spaces=[{x:.025,y:.025,width:.95,height:.95}];
    for(const block of occupied){
        const bx=Math.max(0,block.x-.006),by=Math.max(0,block.y-.006),br=Math.min(1,block.x+block.width+.006),bb=Math.min(1,block.y+block.height+.006);
        spaces=spaces.flatMap(s=>{
            const sr=s.x+s.width,sb=s.y+s.height,l=Math.max(s.x,bx),r=Math.min(sr,br),t=Math.max(s.y,by),b=Math.min(sb,bb);
            if(l>=r||t>=b)return [s];
            return [{x:s.x,y:s.y,width:l-s.x,height:s.height},{x:r,y:s.y,width:sr-r,height:s.height},
                {x:l,y:s.y,width:r-l,height:t-s.y},{x:l,y:b,width:r-l,height:sb-b}].filter(p=>p.width>=.01&&p.height>=.01);
        });
    }
    spaces.sort((a,b)=>b.width*b.height-a.width*a.height);
    const free=spaces[0];
    return free?{x:free.x,y:free.y,width:Math.min(desired.width,free.width),height:Math.min(desired.height,free.height)}:null;
}

export function stripMultiviewBlocks(prompt) {
    return String(prompt||'').replace(/\[闲兔角色多视图\][\s\S]*?\[\/闲兔角色多视图\]/g,'')
        .replace(/(?:文生图：仅依据上述文字描述设计角色，不依赖参考图片；所选视图保持同一人物的面部特征、发型、服装和配色一致。|图生图：以当前分镜上传的角色参考图为身份和外观依据，保持参考图中的面部特征、发型、服装和配色，按所选视图展示同一角色。)[\s\S]*?保留原始角色特征，不额外改变身份或配色。/g,'').trimEnd();
}

export function createApplication(prompt,settings,width,height,generationMode='文生图') {
    const config=normalizeSettings(settings);
    if(!config.selected.length)throw new Error("请至少选择一个视图");
    const layout=makeLayout(config,width,height);
    const headlessBody=layout.panels.some(panel=>panel.headless);
    let base=String(prompt||'');
    if(config.appliedBlock&&base===config.appliedBlock)base='';
    else if(config.appliedBlock&&base.endsWith('\n\n'+config.appliedBlock))base=base.slice(0,-config.appliedBlock.length-2);
    base=stripMultiviewBlocks(base);
    const parts=[...layout.panels].sort((a,b)=>a.x-b.x||a.y-b.y).map(p=>{
        const rules=[config.partPrompts[p.id]||(p.group==='custom'?`仅展示同一角色的${p.label}，保持其设计、配色和材质一致，不添加其他元素`:"保持同一角色的身份、比例、服装及材质一致")];
        if(FULL_BODY_IDS.includes(p.id)){
            const pose=p.id==='left_side'?'严格90°左侧全身，人物朝画面右侧；胸部、骨盆、双脚保持同一侧向，只显示侧面轮廓，不画成正面、背面或四分之三视角。身体直立，双臂自然下垂，远侧手臂允许被遮挡，双腿伸直，不要求两只手臂同时展开':p.id==='back'?'严格180°背面全身，背部和后侧衣服朝向镜头，身体不扭转，不回头，不画成正面或侧面。身体直立，双臂自然向两侧下展，双手放松，双腿伸直':'严格0°正面全身，胸部、骨盆和脚尖朝向镜头，不画成背面或侧面。身体直立，双臂自然向两侧下展，双手放松，双腿伸直';
            rules.push(pose,'只取参考图的外观，不沿用参考图的动作、手势或持物姿势',p.headless?'本分区必须是无头身体视图：仅展示颈根/肩线以下至双脚，不生成头颅、面部或头发，不补全成带头人物；完整保留躯干、双臂、双腿和双脚。头部只能出现在另选的独立头像分区，不能从该头像复制回本身体分区':'从头顶到双脚完整入画','主体在自己的布局区域内等比例尽量放大，仅保留少量安全边距，不跨区、不拉伸、不裁掉手脚');
        }
        return `${p.label}：${rules.join('；')}；布局区域 x=${(p.x/layout.width).toFixed(3)}, y=${(p.y/layout.height).toFixed(3)}, w=${(p.width/layout.width).toFixed(3)}, h=${(p.height/layout.height).toFixed(3)}`;
    }).join("\n");
    const modeRule=generationMode==='图生图'?"图生图：以当前分镜上传的角色参考图为身份和外观依据，保持参考图中的面部特征、发型、服装和配色，按所选视图展示同一角色。":"文生图：仅依据上述文字描述设计角色，不依赖参考图片；所选视图保持同一人物的面部特征、发型、服装和配色一致。";
    const headlessEditRule='Replace the gray mannequins in <Picture 1> with the character from <Picture 2>, wearing that character\'s actual clothes and colors. Use <Picture 1> only for panel placement, camera views and headless framing, not as the output character or visual style. Render the finished character, clothing, hair, skin and accessories in the style of <Picture 2>; do not return a mannequin drawing. Keep the body panels headless; render the character\'s face only in the separate portrait panel.\n编辑任务：将 <Picture 1> 中各分区的人偶替换成 <Picture 2> 的角色，不是给白模保留原样。角色身份、实际服装剪裁、配色和画风来自 <Picture 2>；有后续角色图时仅补充外观细节。只保留 <Picture 1> 的分区位置、视角和颈部以下取景，不保留其白模材质、机械关节、灰色轮廓线或占位文字。身体分区生成穿着角色原服装的颈部以下身体；独立头像分区替换为角色真实头像；自定义分区生成所指定的角色元素。';
    const block=[modeRule,generationMode==='图生图'?(headlessBody?headlessEditRule:'最后一张参考图是灰白人偶布局图，仅用于视角、构图和布局；人物身份和服装来自用户的其他角色参考图或文字描述，不要生成白模材质。'):'',"在同一张角色设定图内按以下分区展示同一角色，分区间保留整洁留白；不要混成多个不同人物。",parts,
        config.selected.some(id=>id==='clothing_front'||id==='clothing_back')?"服装展示："+(config.clothingMode==="garments"?"服装视图仅展示服装，不包含人体":"服装穿在同一角色身上展示"):"",
        config.stylePrompt?"统一风格："+config.stylePrompt:"","保留原始角色特征，不额外改变身份或配色。"].filter(Boolean).join("\n");
    return {prompt:base+(base?"\n\n":"")+block,settings:{...config,appliedBlock:block},layout};
}
