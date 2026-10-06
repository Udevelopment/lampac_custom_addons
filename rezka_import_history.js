/* HDRezka bookmarks -> Lampa/Lampac "История просмотра" importer
 * Settings -> "Остальное" -> "Импорт истории HDRezka"
 * Ищет каждый тайтл в TMDB через сам Lampa и добавляет в историю (history). */
(function(){
'use strict';
console.log('[rezka_import_history] script start');
var LIST=[["films","Красота",1996],["series","Ночные вызовы",2022],["films","Два, три, демон, приди!",2022],["films","Верни её из мёртвых",2025],["films","Анора",2024],["films","Привидения / Вечный дом",2023],["series","Реанимация. Код черный / Реанимация",2015],["cartoons","Скуби-ду",2020],["films","Где моя тачка, чувак?",2000],["films","Красный, белый и королевский синий",2023],["films","Привет, Джули!",2010],["films","Мамочка",2014],["films","Класс",2007],["films","Анатомия падения",2023],["films","Милые кости",2009],["cartoons","Велма",2023],["series","Липучка",2024],["films","Рождество на двоих",2019],["films","Порочное удовольствие",2020],["films","Юные сердца",2024],["films","Рождественский выбор",2020],["films","Неуловимый аромат любви",2021],["films","Оставленные",2023],["films","Рождество кота Боба",2020],["films","Пусть идёт снег",2019],["films","Компания на праздники",2021],["films","Рождество, опять",2014],["films","Братья из Гримсби",2016],["films","Всё ещё Элис",2014],["films","Интерстеллар",2014],["series","Мост",2011],["films","Субстанция / Вещество",2024],["films","Маленькие гиганты",2018],["films","Каменное сердце",2016],["films","Достаточно взрослый",2022],["series","Мы те, кто мы есть",2020],["films","Трепет сердца навсегда",2026],["series","Торе",2023],["series","Скорая помощь",1994],["series","Эйфория",2019],["series","Школа разбитых сердец",2022],["films","Обсессия",2025],["films","Всё везде и сразу",2022],["films","По наклонной",2021],["series","Уэйн",2019],["films","Дюна",2021],["series","Последний человек на Земле",2015],["films","Ночь всегда приходит / Ночь наступает всегда",2025],["films","Сын",2022],["films","Долгая прогулка",2025],["films","Ночная смена",2025],["films","Ключ от всех дверей",2005],["films","Остров проклятых",2010],["films","Адский ад / Чёртов ад",2020],["films","Дело №39",2009],["films","Синистер",2012],["films","Здравствуйте, меня зовут Дорис",2015],["films","Жизнь этого парня",1993],["films","Супер 8",2011],["films","Микки 17",2025],["animation","Человек-бензопила. Фильм: История Резе",2025],["films","Хижина в лесу",2012],["cartoons","Бриклберри",2012],["films","Заклятие",2013],["series","Бесстыжие / Бесстыдники",2011],["animation","Истребитель демонов: Квартал красных фонарей [ТВ-2] / Клинок, рассекающий демонов: Квартал красных фонарей [ТВ-2]",2021],["animation","Истребитель демонов [ТВ-1] / Клинок, рассекающий демонов [ТВ-1]",2019],["films","Поворот не туда",2003],["animation","Истребитель демонов: Поезд «Бесконечный» / Клинок, рассекающий демонов: Бесконечный поезд",2020],["series","Молодые монархи",2021],["films","Красивый мальчик",2018],["series","Переходный возраст / Подросток",2025],["series","Однажды ночью",2016],["series","Монстры / Монстр: История Джеффри Дамера",2022],["series","Монстры: история братьев Менендес",2024],["series","Снегопад",2017],["series","Хороший доктор",2017],["series","Другие двое",2019],["films","Сегодня я пойду домой один / Дорога, которую он выбирает",2014],["series","Это грех",2021]];
var WHERE='history';
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
var netFail=0;
function search(q){return new Promise(function(res){
  try{
    Lampa.Api.search({query:q},function(r){netFail=0;res(r)},function(){netFail++;res(null)});
  }catch(e){netFail++;res(null)}
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
  return score>=2?top:null;
}
function collect(r,kinds,cand){
  if(!r)return;
  kinds.forEach(function(k){
    var g=r[k];
    if(g&&g.results)g.results.forEach(function(c){c.__kind=k;cand.push(c)});
  });
}
async function find(type,title,year){
  var kinds=type==='films'?['movie']:['tv','movie'];
  var cand=[],ns=names(title);
  for(var i=0;i<ns.length;i++){
    collect(await search(ns[i]),kinds,cand);
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
    if(netFail>=6){Lampa.Noty.show('HDRezka: TMDB отвечает ошибкой (401?). Запустите rezkaImportHistory("ваш_email") с email из accsdb Lampac');console.log('[rezka_import_history] stopped at',i);return}
    try{
      var c=await find(it[0],it[1],it[2]);
      if(!c){miss.push(it[1]+' ('+it[2]+')');continue}
      c.media_type=c.__kind;if(c.__kind==='tv'&&!c.name)c.name=c.title;
      if(c.__kind==='tv'&&!c.original_name)c.original_name=c.original_title;
      if(c.__kind==='tv'&&!c.first_air_date)c.first_air_date=c.release_date;
      var st=Lampa.Favorite.check(c);
      if(st&&st[WHERE]){skip++}else{Lampa.Favorite.add(WHERE,c);ok++}
    }catch(e){miss.push(it[1]+' ('+it[2]+') ошибка')}
    if(i%10===9)Lampa.Noty.show('HDRezka: '+(i+1)+'/'+LIST.length);
    await sleep(150);
  }
  console.log('HDRezka import: не найдено',miss);
  window.rezka_history_missed=miss;
  Lampa.Noty.show('Готово: добавлено '+ok+', уже были '+skip+', не найдено '+miss.length+' (список в консоли: rezka_history_missed)');
}
window.rezkaImportHistory=run;
function reg(){
  try{ Lampa.SettingsApi.addParam({
    component:'more',
    param:{name:'rezka_import_history',type:'button'},
    field:{name:'Импорт истории HDRezka',description:'Добавит '+LIST.length+' тайтлов в историю просмотра'},
    onChange:function(){run()}
  }); console.log('[rezka_import_history] button registered'); }catch(e){console.log('[rezka_import_history] reg error',e)}
}
console.log('[rezka_import_history] defined, appready=',window.appready);
if(window.appready)reg();else Lampa.Listener.follow('app',function(e){if(e.type==='ready')reg()});
})();
