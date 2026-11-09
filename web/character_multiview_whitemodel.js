// Self-contained vector clay mannequins: no external images, models or plugins.
const head=(side=false,back=false)=>side?'<path d="M88 24C115 22 126 40 125 58L139 72 126 78 125 95 108 106 108 126 79 126 82 96C63 81 65 49 77 33Z"/>':'<ellipse cx="100" cy="65" rx="36" ry="47"/><path d="M85 104V131H115V104"/>'+(back?'':'<path d="M100 58L95 80 104 81" fill="none" stroke="#adb4b8" stroke-width="2"/><path d="M88 91Q100 96 112 91" fill="none" stroke="#bbc1c4" stroke-width="2"/>');
function body(side=false,back=false){
    if(side)return head(true)+ '<path d="M82 119Q106 110 119 133L124 181 111 198 114 245 123 282 101 285 91 245 88 202 82 245 83 283 63 283 65 239 74 190 70 149Z"/><path d="M112 132Q128 145 126 164L121 215 110 214 110 165 97 143Z"/>';
    return head(false,back)+'<path d="M73 119Q100 109 127 119L140 145 128 181 124 199 76 199 72 181 60 145Z"/><path d="M65 126Q51 128 47 147L32 211 45 216 63 159 76 140Z"/><path d="M135 126Q149 128 153 147L168 211 155 216 137 159 124 140Z"/><path d="M76 192L99 201 94 245 88 283 65 283 71 241Z"/><path d="M124 192L101 201 106 245 112 283 135 283 129 241Z"/><ellipse cx="37" cy="220" rx="9" ry="15"/><ellipse cx="163" cy="220" rx="9" ry="15"/>'+(back?'<path d="M100 129V183M77 140L95 151M123 140L105 151" fill="none" stroke="#b3bbbf" stroke-width="3"/>':'<path d="M77 144Q88 152 99 147M123 144Q112 152 101 147M100 156V183" fill="none" stroke="#b9c0c3" stroke-width="3"/>');
}
function shape(view){
    if(view.group==='custom')return '';
    if(view.id==='hands')return '<path d="M35 172V86Q35 72 43 80L45 121 45 60Q50 48 56 60L59 119 62 51Q68 42 73 54L73 120 81 68Q88 61 91 73L85 143 102 124Q114 123 111 136L88 180 76 215 47 215Z"/><g transform="translate(200 0) scale(-1 1)"><path d="M35 172V86Q35 72 43 80L45 121 45 60Q50 48 56 60L59 119 62 51Q68 42 73 54L73 120 81 68Q88 61 91 73L85 143 102 124Q114 123 111 136L88 180 76 215 47 215Z"/></g>';
    if(view.id==='footwear')return '<path d="M29 95H77L81 167 93 195Q96 210 80 213H26Q15 211 18 197L27 163Z"/><path d="M121 95H165L168 170 186 197Q192 211 178 213H119Q106 211 110 197L119 164Z"/>';
    if(view.id==='clothing_front'||view.id==='clothing_back')return '<path d="M78 58L53 68 26 123 51 135 68 108 60 247H140L132 108 149 135 174 123 147 68 122 58Q100 79 78 58Z"/>'+(view.id==='clothing_front'?'<path d="M100 78V242" stroke="#adb5b9" stroke-width="3"/>':'');
    const side=view.id==='left_portrait'||view.id==='right_portrait'||view.id==='left_side';
    const back=view.id==='rear_portrait'||view.id==='back';
    let content=view.group==='head'?head(side,back):body(side,back);
    if(view.headless&&['front','left_side','back'].includes(view.id))content=content.replace(head(side,back),'');
    if(view.id==='right_portrait')content='<g transform="translate(200 0) scale(-1 1)">'+content+'</g>';
    if(view.id==='left_34'||view.id==='right_34')content='<g transform="translate(16 0) scale(.84 1)">'+head(false,false)+'<path d="M114 49L124 73 112 79" fill="none" stroke="#aeb7bc" stroke-width="3"/></g>';
    if(view.id==='right_34')content='<g transform="translate(200 0) scale(-1 1)">'+content+'</g>';
    return content;
}
export function mannequinMarkup(view,prefix='clay'){
    if(view.group==='custom'){
        const label=String(view.label||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
        return `<text x="100" y="150" text-anchor="middle" font-size="12" fill="#59656b">${label}</text>`;
    }
    const fullBody=['front','left_side','back'].includes(view.id);
    const headView=view.group==='head',box=headView?'45 10 110 130':fullBody?(view.headless?'25 110 150 180':'25 15 150 270'):'10 5 180 290';
    return `<defs><linearGradient id="${prefix}" x1="0" x2="1"><stop stop-color="#aeb8bd"/><stop offset=".35" stop-color="#fafafa"/><stop offset=".7" stop-color="#e1e5e7"/><stop offset="1" stop-color="#aab4ba"/></linearGradient></defs><svg x="${fullBody?'2%':'7%'}" y="${fullBody?'2%':'5%'}" width="${fullBody?'96%':'86%'}" height="${fullBody?'96%':'90%'}" viewBox="${box}" preserveAspectRatio="xMidYMid meet"><g fill="url(#${prefix})" stroke="#919da5" stroke-width="1.5" stroke-linejoin="round">${shape(view)}</g></svg>`;
}
export function panelViewBox(panel){return ['front','left_side','back'].includes(panel.id)?`0 0 ${panel.width} ${panel.height}`:'0 0 200 300';}
export function whiteModelSVG(layout){
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><rect width="100%" height="100%" fill="#ffffff"/>${layout.panels.map((p,i)=>`<g><rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" fill="#ffffff"/><svg x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" viewBox="${panelViewBox(p)}">${mannequinMarkup(p,'clay-'+i)}</svg></g>`).join('')}</svg>`;
}
export async function whiteModelPNG(layout){
    const url=URL.createObjectURL(new Blob([whiteModelSVG(layout)],{type:'image/svg+xml'}));
    try{
        const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('白模布局图渲染失败'));image.src=url;});
        const canvas=document.createElement('canvas');canvas.width=layout.width;canvas.height=layout.height;
        canvas.getContext('2d').drawImage(image,0,0,layout.width,layout.height);
        return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('白模布局图导出失败')),'image/png'));
    }finally{URL.revokeObjectURL(url);}
}
