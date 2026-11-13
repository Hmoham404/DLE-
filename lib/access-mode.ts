export function allowAutomaticLocalAccess(enabled:string|undefined,environment:string|undefined,vercel:string|undefined,host:string|null){
 if(enabled!=='true'||environment!=='development'||vercel)return false;
 return /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(host||'');
}
