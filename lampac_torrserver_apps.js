(function () {
    'use strict';

    // Подставляет адрес, логин и пароль TorrServer из Lampac в приложениях Lampa (ТВ, Android и т.д.),
    // так же как это делает штатный плагин ts.js в веб-версии.
    // Не запускается в браузерах (веб-версия, там работает штатный ts.js), только в приложениях.

    if (window.plugin_lampac_torrserver_apps) return;
    window.plugin_lampac_torrserver_apps = true;

    var KEY_ENABLE = 'lampac_ts_autoset';
    var KEY_HOST = 'lampac_ts_host';
    var KEY_PASS = 'lampac_ts_password';

    function isApp() {
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

        function add(o) {
            if (!o || list.indexOf(o) !== -1) return;
            var host = o.replace(/^https?:\/\//i, '').replace(/:\d+$/, '');
            if (SKIP.test(host)) return;
            list.push(o);
        }

        add(normalizeHost(Lampa.Storage.get(KEY_HOST, '')));

        var i, src;
        var scripts = document.getElementsByTagName('script');
        for (i = 0; i < scripts.length; i++) {
            src = scripts[i].src;
            if (/^https?:/i.test(src)) add(originOf(src));
        }

        try {
            var plugins = Lampa.Storage.get('plugins', '[]');
            if (typeof plugins === 'string') plugins = JSON.parse(plugins);
            for (i = 0; i < plugins.length; i++) {
                src = plugins[i] && plugins[i].url;
                if (/^https?:/i.test(src || '')) add(originOf(src));
            }
        } catch (e) { }

        if (/^https?:$/i.test(location.protocol) && location.host) add(location.origin);

        ['lampac_torrserver_url', 'torrserver_url', 'torrserver_url_two'].forEach(function (k) {
            var v = Lampa.Storage.get(k, '');
            if (/\/ts\/?$/i.test(v || '')) add(originOf(v));
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

    function run() {
        if (!Lampa.Storage.field(KEY_ENABLE)) return;

        var unic_id = Lampa.Storage.get('lampac_unic_id', '');
        if (!unic_id) {
            unic_id = Lampa.Utils.uid(8).toLowerCase();
            Lampa.Storage.set('lampac_unic_id', unic_id);
        }

        var list = candidates();

        probe(list, unic_id, function (host, info) {
            if (!host) {
                Lampa.Noty.show('Lampac TorrServer: сервер не найден, укажите адрес в настройках TorrServer' +
                    ' | страница: ' + location.href.slice(0, 60) + (list.length ? ' | проверено: ' + list.join(', ') : ' | кандидатов нет'));
                return;
            }

            var tsUrl = host + '/ts';
            var cur = Lampa.Storage.get('torrserver_url', '');

            // Основная ссылка наша, пока пользователь не заменил её своей
            if (!cur || cur == tsUrl || cur == Lampa.Storage.get('lampac_torrserver_url', '')) {
                Lampa.Storage.set('torrserver_url', tsUrl);
                Lampa.Storage.set('lampac_torrserver_url', tsUrl);
            }

            applyAuth(tsUrl, info.user_uid);
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

    function start() {
        if (!isApp()) return;

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
