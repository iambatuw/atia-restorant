import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {ImagePlus,Trash2} from 'lucide-react';
import {ApiError,getToken} from './api';
import type {Product} from './types';
import {ErrorBox} from './ui';

async function upload(productId:number,file:File){
  const body=new FormData();
  body.append('dosya',file);
  const token=getToken();
  const response=await fetch(`/api/menu/urunler/${productId}/gorsel`,{method:'POST',body,headers:token?{Authorization:`Bearer ${token}`}:{}});
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.Success) throw new ApiError(data?.title??data?.Message??'Görsel yüklenemedi.',response.status);
  return data.Data as Product;
}

/** Photo shown on the customer menu. JPEG, PNG or WEBP up to 2 MB; the server checks the file signature. */
export function ProductImageEditor({product}:{product:Product}){
  const client=useQueryClient();
  const [version,setVersion]=useState(product.GorselSurumu??0);
  const save=useMutation({mutationFn:(file:File)=>upload(product.KayitNo,file),onSuccess:async result=>{setVersion(result.GorselSurumu??0);await client.invalidateQueries({queryKey:['menu']});}});
  const remove=useMutation({mutationFn:async()=>{
    const token=getToken();
    const response=await fetch(`/api/menu/urunler/${product.KayitNo}/gorsel`,{method:'DELETE',headers:token?{Authorization:`Bearer ${token}`}:{}});
    if(!response.ok) throw new ApiError('Görsel kaldırılamadı.',response.status);
  },onSuccess:async()=>{setVersion(0);await client.invalidateQueries({queryKey:['menu']});}});
  return <div className="op-image-editor">
    {version>0?<img src={`/api/menu/urunler/${product.KayitNo}/gorsel?v=${version}`} alt={`${product.StokAdi} görseli`} width={88} height={88}/>:<span className="op-image-empty">Görsel yok</span>}
    <label className="secondary op-file-button"><ImagePlus size={15}/> {version>0?'Görseli değiştir':'Görsel ekle'}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={save.isPending} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)save.mutate(file);}}/></label>
    {version>0&&<button type="button" className="secondary" disabled={remove.isPending} onClick={()=>remove.mutate()}><Trash2 size={15}/> Kaldır</button>}
    <ErrorBox error={save.error||remove.error}/>
  </div>;
}
