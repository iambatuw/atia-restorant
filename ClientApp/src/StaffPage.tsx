import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Pencil,Plus,UsersRound} from 'lucide-react';
import {api} from './api';
import type {Role,Session,StaffAccount} from './types';
import {Empty,ErrorBox,Loading,Modal} from './ui';
import './Extensions.css';

const roleNames:Record<Role,string>={Admin:'Yönetici',Garson:'Garson',Mutfak:'Mutfak'};

export default function StaffPage({session}:{session:Session}){
  const staff=useQuery({queryKey:['staff'],queryFn:()=>api<StaffAccount[]>('/personel')});
  const [edit,setEdit]=useState<StaffAccount|true|null>(null);
  const list=staff.data??[];
  return <section className="op-page" aria-label="Personel">
    <header className="op-page-head"><div><h1>Personel</h1><p>Kullanıcı hesapları, roller ve şifreler. Rol, durum veya şifre değişince o hesabın açık oturumları kapanır.</p></div>
      <button className="primary" onClick={()=>setEdit(true)}><Plus size={17}/> Personel ekle</button></header>
    <ErrorBox error={staff.error} retry={()=>void staff.refetch()}/>
    {staff.isPending?<Loading/>:list.length===0?<Empty><UsersRound size={28}/><h2>Personel yok</h2></Empty>:
    <section className="op-panel"><div className="op-table-wrap"><table className="op-data-table">
      <thead><tr><th>Ad soyad</th><th>Kullanıcı adı</th><th>Rol</th><th>Durum</th><th>Son giriş</th><th></th></tr></thead>
      <tbody>{list.map(account=><tr key={account.KayitNo}>
        <td><strong>{account.AdSoyad}</strong>{account.KayitNo===session.KullaniciId&&<small>Bu oturum</small>}</td>
        <td>{account.KullaniciAdi}</td><td>{roleNames[account.Rol]??account.Rol}</td>
        <td><span className={`op-badge ${account.Aktif?'is-success':''}`}>{account.Aktif?'Aktif':'Pasif'}</span></td>
        <td>{account.SonGiris?new Date(account.SonGiris).toLocaleString('tr-TR'):'—'}</td>
        <td className="num"><button className="secondary" onClick={()=>setEdit(account)} aria-label={`${account.AdSoyad} düzenle`}><Pencil size={15}/> Düzenle</button></td>
      </tr>)}</tbody></table></div></section>}
    <p className="op-note" style={{marginTop:16}}>Şifreler sunucuda tuzlanmış özet olarak tutulur; kimse mevcut şifreyi göremez. Unutulan şifre yönetici tarafından yenilenir.</p>
    {edit&&<StaffEditor account={edit===true?undefined:edit} self={edit!==true&&edit.KayitNo===session.KullaniciId} close={()=>setEdit(null)}/>}
  </section>;
}

function StaffEditor({account,self,close}:{account?:StaffAccount;self:boolean;close:()=>void}){
  const client=useQueryClient();
  const [username,setUsername]=useState(account?.KullaniciAdi??'');
  const [name,setName]=useState(account?.AdSoyad??'');
  const [role,setRole]=useState<Role>(account?.Rol??'Garson');
  const [active,setActive]=useState(account?.Aktif??true);
  const [password,setPassword]=useState('');
  const save=useMutation({mutationFn:()=>api<StaffAccount>(account?`/personel/${account.KayitNo}`:'/personel',{method:account?'PUT':'POST',
    body:JSON.stringify({KullaniciAdi:username.trim(),AdSoyad:name.trim(),Rol:role,Aktif:active,Sifre:password||null})}),
    onSuccess:async()=>{await client.invalidateQueries({queryKey:['staff']});close();}});
  const passwordValid=account?(password===''||password.length>=6):password.length>=6;
  return <Modal title={account?`${account.AdSoyad} düzenle`:'Yeni personel'} onClose={()=>{if(!save.isPending)close();}}>
    <form className="craft-form" onSubmit={e=>{e.preventDefault();save.mutate();}}>
      <div className="form-row"><label>Ad soyad<input autoFocus required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>Kullanıcı adı<input required minLength={3} maxLength={32} autoCapitalize="none" autoComplete="off" value={username} onChange={e=>setUsername(e.target.value)} placeholder="ör. ayse.k"/></label></div>
      <div className="form-row"><label>Rol<select value={role} disabled={self} onChange={e=>setRole(e.target.value as Role)}>{(Object.keys(roleNames) as Role[]).map(r=><option key={r} value={r}>{roleNames[r]}</option>)}</select></label>
        <label>{account?'Yeni şifre (boş bırakılırsa değişmez)':'Şifre'}<input type="password" autoComplete="new-password" minLength={account?undefined:6} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label></div>
      <label className="op-check-label"><input type="checkbox" checked={active} disabled={self} onChange={e=>setActive(e.target.checked)}/> Hesap aktif</label>
      {self&&<p className="op-note">Kendi hesabınızın rolünü ve durumunu değiştiremezsiniz.</p>}
      {!passwordValid&&<p className="error-text" role="status">Şifre en az 6 karakter olmalı.</p>}
      <ErrorBox error={save.error}/>
      <div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={save.isPending||!name.trim()||username.trim().length<3||!passwordValid}>{save.isPending?'Kaydediliyor…':'Kaydet'}</button></div>
    </form>
  </Modal>;
}
