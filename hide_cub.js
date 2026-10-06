/* Скрывает аккаунт CUB в интерфейсе Lampa (только вид, логику не трогает) */
(function(){
'use strict';
var SEL=[
  '.open--profile',
  '.head__action.open--profile',
  '.settings-folder[data-component="account"]',
  '.settings-folder[data-component="cub"]',
  '.menu__item[data-action="cub"]',
  '[data-component="account"]'
];
function apply(){
  try{
    var st=document.getElementById('hide_cub_css');
    if(!st){st=document.createElement('style');st.id='hide_cub_css';document.head.appendChild(st)}
    st.textContent=SEL.join(',')+'{display:none!important}';
    // элементы, найденные по тексту (на случай других классов)
    document.querySelectorAll('.settings-folder__name,.menu__text').forEach(function(n){
      var t=(n.textContent||'').trim().toLowerCase();
      if(t==='cub'||t==='аккаунт'||t==='cub аккаунт'||t==='account'){
        var p=n.closest('.settings-folder,.menu__item');if(p)p.style.display='none';
      }
    });
  }catch(e){console.log('[hide_cub]',e)}
}
apply();
try{new MutationObserver(function(){apply()}).observe(document.body,{childList:true,subtree:true})}catch(e){}
console.log('[hide_cub] loaded');
})();
