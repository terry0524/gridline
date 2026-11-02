// Apply the saved appearance before first paint, including when storage is blocked.
(() => {
 const root=document.documentElement;
 let theme='dark';
 try{if(localStorage.getItem('gridline-theme')==='light')theme='light';}catch{}
 function apply(){
  root.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f7f8fa':'#0c0f14');
  const button=document.getElementById('themeToggle');
  if(button){button.setAttribute('aria-pressed',String(theme==='light'));button.title=theme==='light'?'어두운 모드로 전환':'밝은 모드로 전환';button.querySelector('span').textContent=theme==='light'?'☾':'☀';}
 }
 apply();
 document.addEventListener('DOMContentLoaded',()=>{
  apply();
  document.getElementById('themeToggle')?.addEventListener('click',()=>{theme=theme==='light'?'dark':'light';try{localStorage.setItem('gridline-theme',theme);}catch{}apply();});
 });
 window.addEventListener('storage',event=>{if(event.key==='gridline-theme'){theme=event.newValue==='light'?'light':'dark';apply();}});
})();
