(function(){var SKIN_V='55751e4e1d';var d=document.documentElement;try{var v=localStorage.getItem('khaylub-theme');if(v==='light'||v==='dark')d.setAttribute('data-theme',v)}catch(e){}
var M={hiring:['paper','lean'],tech:['desert-night','standard'],creative:['arizona-made','full'],exploring:['golden-hour','full'],youtube:['above-the-clouds','full'],nostalgia:['profile-2006','standard']};
var a=null;try{a=localStorage.getItem('khaylub-audience')}catch(e){}
if(!a||!Object.prototype.hasOwnProperty.call(M,a))return;
d.setAttribute('data-audience',a);d.setAttribute('data-skin',M[a][0]);d.setAttribute('data-tier',M[a][1]);
if(M[a][1]==='lean')return;
var l=document.createElement('link');l.id='skin-css';l.rel='stylesheet';l.href='/skins/'+M[a][0]+'.css?v='+SKIN_V;
var done=function(){d.classList.remove('skin-wait')};d.classList.add('skin-wait');l.onload=done;l.onerror=function(){d.removeAttribute('data-tier');done()};setTimeout(done,1500);
document.head.appendChild(l)})();
