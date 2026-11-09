import {normalizeSettings,settingsViews} from './character_multiview_core.js';

export const STORAGE_KEY='comfyui-character-multiview-workbench.library.v1';
export const HISTORY_TTL=24*60*60*1000;

export function layoutSnapshot(value) {
    const settings=normalizeSettings(value.settings||value);
    return {selected:[...settings.selected],layout:Object.fromEntries(settings.selected.filter(id=>settings.layout[id]).map(id=>[id,{...settings.layout[id]}])),
        customViews:settings.customViews.map(v=>({...v})),headless:settings.headless,
        partPrompts:{...settings.partPrompts},stylePrompt:settings.stylePrompt,clothingMode:settings.clothingMode};
}

export function restoreLayout(settings,record) {
    return {...normalizeSettings(settings),...layoutSnapshot(record)};
}

export function createLibrary(storage,now=()=>Date.now()) {
    const write=data=>storage.setItem(STORAGE_KEY,JSON.stringify(data));
    function read(){
        const raw=storage.getItem(STORAGE_KEY);
        const data=raw?JSON.parse(raw):{autoDelete:true,history:[],favorites:[]};
        if(!Array.isArray(data.history)||!Array.isArray(data.favorites))throw new Error('多视图本地记录格式无效，未覆盖已有记录');
        let migrated=false;
        for(const group of ['history','favorites'])data[group]=data[group].map(record=>{
            const snapshot=layoutSnapshot(record);
            if(record.settings||'prompt' in record||'generationMode' in record)migrated=true;
            return {id:record.id,createdAt:record.createdAt,title:settingsViews(snapshot).filter(v=>snapshot.selected.includes(v.id)).map(v=>v.label).join(' / '),...snapshot};
        });
        data.autoDelete=data.autoDelete!==false;
        if(data.autoDelete){
            const kept=data.history.filter(record=>now()-record.createdAt<HISTORY_TTL);
            if(kept.length!==data.history.length){data.history=kept;migrated=true;}
        }
        if(migrated)write(data);
        return data;
    }
    function capture(settings){
        const snapshot=layoutSnapshot(settings);
        return {id:crypto.randomUUID(),createdAt:now(),title:settingsViews(snapshot).filter(v=>snapshot.selected.includes(v.id)).map(v=>v.label).join(' / '),...snapshot};
    }
    return {
        read,
        add(settings,favorite=false){
            const data=read(),record=capture(settings);
            data[favorite?'favorites':'history'].unshift(record);write(data);return structuredClone(record);
        },
        favorite(record){const data=read();if(!data.favorites.some(item=>item.id===record.id)){data.favorites.unshift(structuredClone(record));write(data);}},
        unfavorite(id){const data=read();data.favorites=data.favorites.filter(item=>item.id!==id);write(data);},
        setAutoDelete(enabled){const data=read();data.autoDelete=Boolean(enabled);write(data);return read();},
    };
}
