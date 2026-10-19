(function () {
    'use strict';

    if (window.plugin_torrent_external_player) return;
    window.plugin_torrent_external_player = true;

    var KEY_ENABLE = 'torrent_external_enable';
    var KEY_TYPE = 'torrent_external_type';

    function isMac() {
        var p = (navigator.platform || '') + ' ' + (navigator.userAgent || '');
        return /Mac/i.test(p) && !/iPhone|iPad|iPod|Android/i.test(p);
    }

    function defaultType() {
        return isMac() ? 'iina' : 'potplayer';
    }

    function parseHost(url) {
        if (!url) return '';
        url = String(url).trim();
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = 'http://' + url;
        try {
            return new URL(url).hostname.toLowerCase();
        } catch (e) {
            return '';
        }
    }

    function isLocalHost(host) {
        return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
    }

    function torrserverHosts() {
        var hosts = [];
        ['torrserver_url', 'torrserver_url_two'].forEach(function (k) {
            var h = parseHost(Lampa.Storage.get(k, ''));
            if (h) hosts.push(h);
        });
        return hosts;
    }

    // Активный торрсервер (учитываем выбор "основная/дополнительная ссылка")
    function activeTorrserverHost() {
        var useTwo = Lampa.Storage.field('torrserver_use_link') === 'two';
        var h = parseHost(Lampa.Storage.get(useTwo ? 'torrserver_url_two' : 'torrserver_url', ''));
        if (h) return h;
        return torrserverHosts()[0] || '';
    }

    function isTorrentStream(url) {
        if (typeof url !== 'string') return false;
        var host = parseHost(url);
        if (!host) return false;
        return torrserverHosts().indexOf(host) !== -1 && /\/(ts\/)?(stream|play)(\/|\?|$)/i.test(url);
    }

    function buildLink(type, url) {
        switch (type) {
            case 'vlc':
                return 'vlc://' + url;
            case 'iina':
                return 'iina://weblink?url=' + encodeURIComponent(url);
            case 'potplayer':
            default:
                return 'potplayer://' + url;
        }
    }

    function openExternal(link) {
        var a = document.createElement('a');
        a.href = link;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { a.remove(); }, 500);
    }

    function shouldHandle(url) {
        if (!Lampa.Storage.field(KEY_ENABLE)) return false;
        if (!isTorrentStream(url)) return false;
        var host = activeTorrserverHost();
        return !!host && !isLocalHost(host);
    }

    function hookPlayer() {
        var original = Lampa.Player.play;

        Lampa.Player.play = function (params) {
            try {
                if (params && shouldHandle(params.url)) {
                    var type = Lampa.Storage.get(KEY_TYPE, defaultType());
                    openExternal(buildLink(type, params.url));
                    Lampa.Noty.show('Открываю во внешнем плеере: ' + ({ vlc: 'VLC', potplayer: 'PotPlayer', iina: 'IINA' }[type] || type));
                    return;
                }
            } catch (e) {
                console.log('torrent_external_player', e);
            }
            return original.apply(this, arguments);
        };
    }

    function addSettings() {
        if (!Lampa.Storage.get(KEY_TYPE, '')) Lampa.Storage.set(KEY_TYPE, defaultType());

        Lampa.SettingsApi.addParam({
            component: 'player',
            param: {
                name: KEY_ENABLE,
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Торренты во внешнем плеере',
                description: 'Если TorrServer не localhost/127.0.0.1, торренты открываются во внешнем плеере'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'player',
            param: {
                name: KEY_TYPE,
                type: 'select',
                values: {
                    vlc: 'VLC',
                    potplayer: 'PotPlayer',
                    iina: 'IINA'
                },
                default: defaultType()
            },
            field: {
                name: 'Внешний плеер для торрентов',
                description: 'По умолчанию: IINA на macOS, PotPlayer на Windows'
            }
        });
    }

    function start() {
        addSettings();
        hookPlayer();
    }

    if (window.appready) start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }
})();
