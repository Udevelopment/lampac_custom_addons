(function () {
    'use strict';

    // Подставляет адрес, логин и пароль TorrServer из Lampac в приложениях Lampa (ТВ, Android и т.д.),
    // так же как это делает штатный плагин ts.js в веб-версии.
    // Запускается только в приложениях; в обычном браузере ничего не делает.

    if (window.plugin_lampac_torrserver_apps) return;
    window.plugin_lampac_torrserver_apps = true;

    var KEY_ENABLE = 'lampac_ts_autoset';
    var KEY_HOST = 'lampac_ts_host';
    var KEY_PASS = 'lampac_ts_password';

    function isApp() {
        var p = '';
        try { p = Lampa.Platform.get(); } catch (e) { }
        return !!p && p !== 'browser';
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

    // Адрес Lampac: из настройки, иначе по адресу его скриптов, уже загруженных в Лампу
    function detectHost() {
        var manual = normalizeHost(Lampa.Storage.get(KEY_HOST, ''));
        if (manual) return manual;

        var re = /\/(lampainit|privateinit|ts|online|sisi|tracks|sync|timecode|dlna)(\.js|\/js\/)/i;
        var i, src;

        var scripts = document.getElementsByTagName('script');
        for (i = 0; i < scripts.length; i++) {
            src = scripts[i].src;
            if (src && re.test(src)) return originOf(src);
        }

        try {
            var plugins = Lampa.Storage.get('plugins', '[]');
            if (typeof plugins === 'string') plugins = JSON.parse(plugins);
            for (i = 0; i < plugins.length; i++) {
                src = plugins[i] && plugins[i].url;
                if (src && re.test(src)) return originOf(src);
            }
        } catch (e) { }

        return '';
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

    function run() {
        if (!Lampa.Storage.field(KEY_ENABLE)) return;

        var host = detectHost();
        if (!host) return;

        var unic_id = Lampa.Storage.get('lampac_unic_id', '');
        if (!unic_id) {
            unic_id = Lampa.Utils.uid(8).toLowerCase();
            Lampa.Storage.set('lampac_unic_id', unic_id);
        }

        var tsUrl = host + '/ts';
        var cur = Lampa.Storage.get('torrserver_url', '');

        // Основная ссылка наша, пока пользователь не заменил её своей
        if (!cur || cur == tsUrl || cur == Lampa.Storage.get('lampac_torrserver_url', '')) {
            Lampa.Storage.set('torrserver_url', tsUrl);
            Lampa.Storage.set('lampac_torrserver_url', tsUrl);
        }

        var uri = host + '/reqinfo?account_email=' + encodeURIComponent(Lampa.Storage.get('account_email', '')) +
            '&uid=' + encodeURIComponent(unic_id);

        var network = new Lampa.Reguest();
        network.silent(uri, function (j) {
            if (j && j.user_uid) applyAuth(tsUrl, j.user_uid);
        });
    }

    function addSettings() {
        Lampa.SettingsApi.addParam({
            component: 'server',
            param: { name: KEY_ENABLE, type: 'trigger', default: true },
            field: {
                name: 'Автоподстановка TorrServer от Lampac',
                description: 'В приложении подставлять адрес, логин и пароль TorrServer с вашего сервера Lampac'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'server',
            param: { name: KEY_HOST, type: 'input', values: '', default: '' },
            field: {
                name: 'Адрес Lampac',
                description: 'Например http://192.168.1.220:9118. Пусто: определяется автоматически'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'server',
            param: { name: KEY_PASS, type: 'input', values: '', default: 'ts' },
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
