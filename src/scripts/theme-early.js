// Before first paint: apply a stored Appearance choice (F4; the control is src/scripts/theme.ts) and a
// stored audience (Profile Themes, 2026-10-10; the picker is src/scripts/audience.ts). The audience
// map must match content/profile/audiences.yaml (tests/skins.spec.ts holds them together). A skin
// stylesheet is linked only for Standard and Full; the page waits for it at most 1.5 s.
(function(){var d=document.documentElement;try{var v=localStorage.getItem('khaylub-theme');if(v==='light'||v==='dark')d.setAttribute('data-theme',v)}catch(e){}
var M={hiring:['paper','lean'],tech:['desert-night','standard'],creative:['arizona-made','full'],exploring:['golden-hour','full'],youtube:['above-the-clouds','full'],nostalgia:['profile-2006','standard']};
var a=null;try{a=localStorage.getItem('khaylub-audience')}catch(e){}
if(!a||!Object.prototype.hasOwnProperty.call(M,a))return;
d.setAttribute('data-audience',a);d.setAttribute('data-skin',M[a][0]);d.setAttribute('data-tier',M[a][1]);
if(M[a][1]==='lean')return;
var l=document.createElement('link');l.id='skin-css';l.rel='stylesheet';l.href='/skins/'+M[a][0]+'.css';
var done=function(){d.classList.remove('skin-wait')};d.classList.add('skin-wait');l.onload=done;l.onerror=done;setTimeout(done,1500);
document.head.appendChild(l)})();
