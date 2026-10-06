/* HDRezka bookmarks -> Lampa/Lampac "Избранное" importer
 * Settings -> "Остальное" -> "Импорт закладок HDRezka"
 * Ищет каждый тайтл в TMDB через сам Lampa и добавляет в закладки (book). */
(function(){
'use strict';
console.log('[rezka_import] script start');
var LIST=[["series","В поиске",2014],["series","Близкие друзья",1999],["series","Поза",2018],["series","Вы нам не подходите",2026],["series","Родственная душа",2026],["series","Получеловек",2026],["series","Во все тяжкие",2008],["series","Извне",2022],["films","Мумия",2026],["films","Достать ножи",2019],["series","Молодой Шерлок",2026],["animation","Поднятие уровня в одиночку [ТВ-1]",2024],["animation","Дарованный",2020],["animation","Рыбка-бананка",2018],["series","Тьма",2017],["series","У меня очень плохое предчувствие",2026],["animation","Дарованный",2019],["films","Я ругаюсь",2025],["series","Притворство / Акт",2019],["animation","Мой сосед у меня на коленях, а иногда на голове / Домашний питомец, иногда сидящий на моей голове",2019],["films","Луркер / Прилипала",2025],["films","Бугония",2025],["series","Его и ее",2026],["series","Земля греха",2026],["films","Умри, моя любовь",2025],["films","Бессонная ночь",2011],["films","Тихая гавань",2013],["films","Побеждая время",2012],["films","Мой личный штат Айдахо",1991],["films","Лунный свет",2016],["films","Все по новой",2016],["series","Рассказ служанки",2017],["films","Парни не плачут",1999],["series","С чистого листа",2016],["films","Главы государств",2025],["series","Реутов ТВ",2010],["films","Грабитель с крыши",2025],["series","Очень странные дела / Загадочные события",2016],["series","Хэдшот",2023],["animation","Лето, когда погас свет / Лето, когда умер Хикару",2025],["cartoons","Робоцып",2005],["series","Как избежать наказания за убийство",2014],["series","Уборщица. История матери-одиночки",2021],["series","Царство животных / По волчьим законам",2016],["series","Сверхкомпенсация / Гиперкомпенсация",2025],["films","Хозяин",2023],["films","Верный друг",2024],["series","Охотник за разумом",2017],["films","Хороший человек",2023],["films","Я убил свою маму",2009],["series","Третья смена",1999],["series","CSI: Вегас",2021],["series","Веди себя нормально / Просто веди себя как обычно",2025],["series","Расследования авиакатастроф",2003],["series","Нарковоры / Вор дури",2025],["series","Ночь, когда Логан проснулся",2022],["films","Матиас и Максим",2019],["series","Локерби / Локерби: В поисках правды",2025],["films","Пиф-паф, ты – мертв",2002],["films","Эффект бабочки",2004],["series","Бессонница",2024],["series","Как же хорошо... / Чувствую себя хорошо",2020],["series","На вызове",2025],["series","Больница Питт",2025],["films","Рождественский домик",2019],["films","Сияние",1980],["films","Красивые существа",2022],["series","Большая маленькая ложь",2017],["series","Голубые огни",2023],["films","Я люблю тебя, теперь умри",2019],["series","Убийство на пляже / Бродчёрч",2013],["series","Выход есть",2019],["cartoons","Американский папаша",2005],["series","Этим летом я стала красивой",2022],["series","Женщина в озере",2024],["series","Санни",2024],["series","Ни одной больше",2024],["series","Стыд. Франция",2018],["series","Нетипичный",2017],["series","Трепет сердца",2022],["series","Хороших девочек не убивают",2024],["series","Пожарная часть 19",2018],["series","Новобранец / Новичок / Салага",2018],["series","911 служба спасения",2018],["series","Чикаго в огне / Пожарные Чикаго",2012],["series","Полиция Чикаго",2014],["series","Спасите меня",2024],["series","Эрик",2024],["series","Кумир",2023],["series","Призраки",2024],["series","Американская история преступлений",2016],["series","Элита",2018],["series","Голяк / Без гроша / На мели",2019],["series","Черное зеркало",2011],["series","Убийство на краю света",2023],["series","Третий лишний",2024],["series","Мальчик глотает Вселенную",2024],["series","Джентльмены",2024],["series","Увидимся в другой жизни",2024],["series","Настоящий детектив",2014],["series","Карточный домик",2013],["series","Правительство",2010],["series","Медики Чикаго",2015]];
var WHERE='book'; // book=Избранное, like=Нравится, wath=Позже
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
var netFail=0;
function auth(url){
  var em=window.rezka_email||Lampa.Storage.get('account_email','')||'';
  if(em&&url.indexOf('account_email=')<0)url+=(url.indexOf('?')>=0?'&':'?')+'account_email='+encodeURIComponent(em);
  return url;
}
function get(url){return new Promise(function(res){
  var n=new Lampa.Reguest();
  n.silent(url,function(j){netFail=0;res(j)},function(){netFail++;res(null)});
})}
function norm(s){return (s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim()}
function names(t){
  var out=[],base=t.replace(/\[[^\]]*\]/g,'').trim();
  out.push(base);
  base.split(/\s+\/\s+/).forEach(function(p){p=p.trim();if(p&&out.indexOf(p)<0)out.push(p)});
  return out;
}
function yr(c){return parseInt(((c.release_date||c.first_air_date)||'').slice(0,4))||0}
function best(res,year,nm){
  var want=names(nm).map(norm),top=null,score=-1;
  res.forEach(function(c){
    var s=0,y=yr(c);
    var t=[c.title,c.name,c.original_title,c.original_name].map(norm);
    if(t.some(function(x){return want.indexOf(x)>=0}))s+=4;
    if(year&&y){if(y===year)s+=3;else if(Math.abs(y-year)===1)s+=1;else s-=2}
    s+=Math.min(c.popularity||0,100)/200;
    if(s>score){score=s;top=c}
  });
  return score>=2?top:null; // нужен хотя бы год или точное имя
}
async function find(type,title,year){
  var kinds=type==='films'?['movie']:['tv','movie'];
  var cand=[];
  var ns=names(title);
  for(var i=0;i<ns.length;i++){
    for(var k=0;k<kinds.length;k++){
      var u='search/'+kinds[k]+'?query='+encodeURIComponent(ns[i])+'&language=ru&include_adult=false';
      var j=await get(auth(Lampa.TMDB.api(u)));
      if(j&&j.results)j.results.forEach(function(c){c.__kind=kinds[k];cand.push(c)});
    }
    var b=best(cand,year,title);
    if(b)return b;
  }
  return null;
}
async function run(email){
  if(typeof email==='string'&&email)window.rezka_email=email;
  netFail=0;
  var ok=0,skip=0,miss=[];
  Lampa.Noty.show('HDRezka: импорт '+LIST.length+' закладок...');
  for(var i=0;i<LIST.length;i++){
    var it=LIST[i];
    if(netFail>=6){Lampa.Noty.show('HDRezka: TMDB отвечает ошибкой (401?). Запустите rezkaImport("ваш_email") с email из accsdb Lampac');console.log('[rezka_import] stopped at',i);return}
    try{
      var c=await find(it[0],it[1],it[2]);
      if(!c){miss.push(it[1]+' ('+it[2]+')');continue}
      if(c.__kind==='tv'&&!c.name)c.name=c.title;
      if(c.__kind==='tv'&&!c.original_name)c.original_name=c.original_title;
      if(c.__kind==='tv'&&!c.first_air_date)c.first_air_date=c.release_date;
      var st=Lampa.Favorite.check(c);
      if(st&&st[WHERE]){skip++}else{Lampa.Favorite.add(WHERE,c);ok++}
    }catch(e){miss.push(it[1]+' ('+it[2]+') ошибка')}
    if(i%10===9)Lampa.Noty.show('HDRezka: '+(i+1)+'/'+LIST.length);
    await sleep(150);
  }
  console.log('HDRezka import: не найдено',miss);
  window.rezka_import_missed=miss;
  Lampa.Noty.show('Готово: добавлено '+ok+', уже были '+skip+', не найдено '+miss.length+' (список в консоли: rezka_import_missed)');
}
window.rezkaImport=run;
function reg(){
  try{ Lampa.SettingsApi.addParam({
    component:'more',
    param:{name:'rezka_import',type:'button'},
    field:{name:'Импорт закладок HDRezka',description:'Добавит '+LIST.length+' тайтлов в закладки'},
    onChange:function(){run()}
  }); console.log('[rezka_import] button registered'); }catch(e){console.log('[rezka_import] reg error',e)}
}
console.log('[rezka_import] defined, appready=',window.appready);
if(window.appready)reg();else Lampa.Listener.follow('app',function(e){if(e.type==='ready')reg()});
})();
