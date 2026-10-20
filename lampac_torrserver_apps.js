(function () {
    'use strict';

    // Подставляет адрес, логин и пароль TorrServer из Lampac в приложениях Lampa (ТВ, Android и т.д.),
    // так же как это делает штатный плагин ts.js в веб-версии.
    // Не запускается в браузерах (веб-версия, там работает штатный ts.js), только в приложениях.

    if (window.plugin_lampac_torrserver_apps) return;
    window.plugin_lampac_torrserver_apps = true;

    // Адрес Lampac можно передать прямо в ссылке плагина: .../lampac_torrserver_apps.js?host=http://192.168.1.220:9118
    var SELF_SRC = '';
    try { SELF_SRC = (document.currentScript && document.currentScript.src) || ''; } catch (e) { }

    function hostFromSelf() {
        var m = SELF_SRC.match(/[?&]host=([^&#]+)/i);
        if (!m) return '';
        try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
    }

    // Журнал работы плагина, виден в настройках TorrServer (пункт "Статус плагина")
    var LOG = [];
    function note(msg) {
        LOG.push(msg);
        try { Lampa.Storage.set('lampac_ts_status', LOG.slice(-8).join(' | ')); } catch (e) { }
    }

    var KEY_ENABLE = 'lampac_ts_autoset';
    var KEY_HOST = 'lampac_ts_host';
    var KEY_PASS = 'lampac_ts_password';

    function isApp() {
        // Lampa Desktop (Electron): preload отдаёт window.electronAPI, платформа на macOS может определиться иначе
        if (window.electronAPI) return true;

        var p = '';
        try { p = Lampa.Platform.get(); } catch (e) { }
        if (p === 'browser') return false;

        // Неопознанный клиент (платформа пустая): обычная веб-страница с сервера - это браузер, не приложение
        if (!p && /^https?:$/i.test(location.protocol) && !/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname)) return false;

        return true;
    }

    function normalizeHost(h) {
        h = (h || '').trim().replace(/\/+$/, '').replace(/\/ts$/i, '');
        if (!h) return '';
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(h)) h = 'http://' + h;
        return h;
    }

    function originOf(url) {
        var m = String(url || '').match(/^(https?:\/\/[^\/?#]+)/i);
        return m ? m[1] : '';
    }

    var SKIP = /(^|\.)(jsdelivr\.net|github\.io|githubusercontent\.com|github\.com|cloudflare\.com|cdnjs\.cloudflare\.com|unpkg\.com|googleapis\.com|gstatic\.com|cub\.red|cub\.rip|lampa\.mx|tmdb\.org|themoviedb\.org|yandex\.[a-z]+|google\.[a-z]+)$/i;

    // Кандидаты на адрес Lampac: настройка, затем адреса уже загруженных скриптов и плагинов
    function candidates() {
        var list = [];
        var likelyRe = /\/(lampainit|privateinit|ts|online|sisi|tracks|sync|timecode|dlna|lampac|jac|jacred)(\.js|\/js\/|\/|$)/i;
        list.likely = [];

        function add(o, url) {
            if (o && url && likelyRe.test(url) && list.likely.indexOf(o) === -1) list.likely.push(o);
            addPlain(o);
        }

        function addPlain(o) {
            if (!o || list.indexOf(o) !== -1) return;
            var host = o.replace(/^https?:\/\//i, '').replace(/:\d+$/, '');
            if (SKIP.test(host)) return;
            list.push(o);
        }

        addPlain(normalizeHost(Lampa.Storage.get(KEY_HOST, '')));
        addPlain(normalizeHost(hostFromSelf()));

        var i, src;
        var scripts = document.getElementsByTagName('script');
        for (i = 0; i < scripts.length; i++) {
            src = scripts[i].src;
            if (/^https?:/i.test(src)) add(originOf(src), src);
        }

        try {
            var plugins = Lampa.Storage.get('plugins', '[]');
            if (typeof plugins === 'string') plugins = JSON.parse(plugins);
            for (i = 0; i < plugins.length; i++) {
                src = plugins[i] && plugins[i].url;
                if (/^https?:/i.test(src || '')) add(originOf(src), src);
            }
        } catch (e) { }

        if (/^https?:$/i.test(location.protocol) && location.host) addPlain(location.origin);

        ['lampac_torrserver_url', 'torrserver_url', 'torrserver_url_two'].forEach(function (k) {
            var v = Lampa.Storage.get(k, '');
            if (/\/ts\/?$/i.test(v || '')) add(originOf(v), v);
        });

        return list;
    }

    function applyAuth(tsUrl, login) {
        // Логин и пароль общие для обеих ссылок, поэтому трогаем их, только если активна наша ссылка
        var one = Lampa.Storage.get('torrserver_url', '');
        var two = Lampa.Storage.get('torrserver_url_two', '');
        var active = Lampa.Storage.field('torrserver_use_link') == 'two' ? (two || one) : (one || two);

        if (active != tsUrl) return;

        Lampa.Storage.set('torrserver_auth', 'true');
        Lampa.Storage.set('torrserver_login', login);
        Lampa.Storage.set('torrserver_password', Lampa.Storage.get(KEY_PASS, 'ts') || 'ts');
    }

    // Проверяем кандидатов запросом /reqinfo: настоящий Lampac отвечает JSON с user_uid
    function probe(list, unic_id, done) {
        if (!list.length) return done(null);

        var host = list[0];
        var uri = host + '/reqinfo?account_email=' + encodeURIComponent(Lampa.Storage.get('account_email', '')) +
            '&uid=' + encodeURIComponent(unic_id);

        var network = new Lampa.Reguest();
        network.timeout(8000);
        network.silent(uri, function (j) {
            if (j && j.user_uid) done(host, j);
            else probe(list.slice(1), unic_id, done);
        }, function () {
            probe(list.slice(1), unic_id, done);
        });
    }

    function apply(host, login) {
        var tsUrl = host + '/ts';
        var cur = Lampa.Storage.get('torrserver_url', '');

        // Локальный адрес (например, http://localhost:8090, который Lampa Desktop ставит по умолчанию) тоже считаем заменяемым
        var isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(cur);

        // Основная ссылка наша, пока пользователь не заменил её своей (не локальной и не нашей)
        if (!cur || isLocal || cur == tsUrl || cur == Lampa.Storage.get('lampac_torrserver_url', '')) {
            Lampa.Storage.set('torrserver_url', tsUrl);
            Lampa.Storage.set('lampac_torrserver_url', tsUrl);
        }

        applyAuth(tsUrl, login);

        note('применено: ' + tsUrl + ', вход по паролю=' + Lampa.Storage.get('torrserver_auth', ''));
        Lampa.Noty.show('Lampac TorrServer: ' + tsUrl);
    }

    function run() {
        if (!Lampa.Storage.field(KEY_ENABLE)) return;

        var unic_id = Lampa.Storage.get('lampac_unic_id', '');
        if (!unic_id) {
            unic_id = Lampa.Utils.uid(8).toLowerCase();
            Lampa.Storage.set('lampac_unic_id', unic_id);
        }

        var list = candidates();
        note('кандидаты: ' + (list.join(', ') || 'нет') + (hostFromSelf() ? ', host в ссылке=' + hostFromSelf() : ', host в ссылке нет'));

        probe(list, unic_id, function (host, info) {
            if (host) { note('reqinfo ок: ' + host); return apply(host, info.user_uid); }
            note('reqinfo не ответил');

            // /reqinfo недоступен (например, смешанный http/https): берём адрес без проверки
            var manual = normalizeHost(Lampa.Storage.get(KEY_HOST, '')) || normalizeHost(hostFromSelf());
            var guess = manual || (list.likely && list.likely[0]) || '';

            if (guess) return apply(guess, unic_id);

            note('сервер не найден');
            Lampa.Noty.show('Lampac TorrServer: сервер не найден, укажите адрес в настройках TorrServer' +
                ' | страница: ' + location.href.slice(0, 60) + (list.length ? ' | проверено: ' + list.join(', ') : ' | кандидатов нет'));
        });
    }

    function addSettings() {
        Lampa.SettingsApi.addParam({
            component: 'server',
            param: { name: KEY_ENABLE, type: 'trigger', default: true },
            onChange: run,
            field: {
                name: 'Автоподстановка TorrServer от Lampac',
                description: 'В приложении подставлять адрес, логин и пароль TorrServer с вашего сервера Lampac'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'server',
            param: { name: KEY_HOST, type: 'input', values: '', default: '', placeholder: 'Определяется автоматически' },
            onChange: run,
            field: {
                name: 'Адрес Lampac',
                description: 'Например http://192.168.1.220:9118. Пусто: определяется автоматически'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'server',
            param: { name: KEY_PASS, type: 'input', values: '', default: 'ts', placeholder: 'ts' },
            onChange: run,
            field: {
                name: 'Пароль TorrServer Lampac',
                description: 'Значение defaultPasswd в секции TorrServer, по умолчанию ts'
            }
        });
    }

    function addStatus() {
        Lampa.SettingsApi.addParam({
            component: 'server',
            param: { name: 'lampac_ts_status_item', type: 'static' },
            field: { name: 'Статус плагина Lampac TorrServer', description: '...' },
            onRender: function (item) {
                var text = Lampa.Storage.get('lampac_ts_status', '') || 'плагин не запускался';
                item.find('.settings-param__descr').text(text);
            }
        });
    }

    function start() {
        try { startInner(); } catch (e) {
            try { Lampa.Noty.show('Lampac TS plugin: ошибка ' + (e && e.message)); } catch (e2) { }
            console.log('lampac_torrserver_apps', e);
        }
    }

    function startInner() {
        var plat = '';
        try { plat = Lampa.Platform.get(); } catch (e) { }

        note('платформа=' + (plat || 'пусто') + ', страница=' + location.href.slice(0, 40));
        Lampa.Noty.show('Lampac TS plugin: платформа=' + (plat || 'пусто') + (window.electronAPI ? ', Lampa Desktop' : ''));

        if (plat !== 'browser' || window.electronAPI) addStatus();

        if (!isApp()) {
            note('пропущено: это браузер');
            return;
        }

        addSettings();
        run();
    }

    if (window.appready) start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }
})();
