import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from './api';
import type {RestaurantSettings} from './types';
import {ErrorBox,Loading} from './ui';

export function SettingsPage(){
  const client=useQueryClient();
  const settings=useQuery({queryKey:['settings'],queryFn:()=>api<RestaurantSettings>('/ayarlar')});
  const update=useMutation({
    mutationFn:(enabled:boolean)=>api<RestaurantSettings>('/ayarlar/zayi',{
      method:'PUT',body:JSON.stringify({ZayiAktif:enabled})
    }),
    onSuccess:data=>client.setQueryData(['settings'],data)
  });
  const enabled=settings.data?.ZayiAktif===true;

  return <section className="op-page op-settings-page" aria-label="Ayarlar">
    <header className="op-page-head"><div><h1>Ayarlar</h1><p>Restoran işlem seçeneklerini yönetin</p></div></header>
    <ErrorBox error={settings.error} retry={()=>void settings.refetch()}/>
    {settings.isPending?<Loading/>:settings.data&&<div className="op-settings-card">
      <div><h2>Zayi işlemi</h2><p>Etkin olduğunda adisyondan ürün çıkarma penceresinde “Zayi” seçeneği görünür. Kapalıyken zayi kaydı yapılamaz.</p></div>
      <div className="op-settings-action"><strong>{enabled?'Aktif':'Kapalı'}</strong><button type="button" className={enabled?'secondary':'primary'} aria-pressed={enabled} disabled={update.isPending} onClick={()=>update.mutate(!enabled)}>{update.isPending?'Kaydediliyor…':enabled?'Zayiyi kapat':'Zayiyi etkinleştir'}</button></div>
      <ErrorBox error={update.error}/>
    </div>}
  </section>;
}
