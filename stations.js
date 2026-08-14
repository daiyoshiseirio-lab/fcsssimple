/* ==========================================================
   FCSS-Simple stations.js
   消防署データ(CSV)の読み込みと、火点からの直線距離順ソート
   ※地図マーカーは表示せず、文字情報のみで一覧化する
========================================================== */

var STATIONS = [];

/* ==========================================================
   消防署CSV読み込み
   cache:"no-store" で常に最新のCSVを取得する
========================================================== */

function loadStationData() {

    return fetch("stations.csv", { cache: "no-store" })

        .then(function (res) {

            if (!res.ok) {

                throw new Error("stations.csvの読み込みに失敗しました（" + res.status + "）");

            }

            return res.text();

        })

        .then(function (text) {

            var rows = parseCSV(text);

            STATIONS.length = 0;

            rows.forEach(function (r) {

                STATIONS.push(r);

            });

            console.log("消防署データ読み込み完了：", STATIONS.length, "件");

        })

        .catch(function (err) {

            console.error(err);

            // 消防署データが無くても水利検索自体は動かしたいので、
            // ここではalertを出さずコンソール警告のみに留める

        });

}

/* ==========================================================
   火点から近い順に消防署を並べる（直線距離のみ、参考値）
========================================================== */

function getNearestStations(fireLat, fireLng, topN) {

    var list = STATIONS.map(function (s) {

        var d = getDistance(fireLat, fireLng, Number(s.lat), Number(s.lng));

        return {
            id: s.id,
            name: s.name,
            address: s.address,
            memo: s.memo,
            distance: d
        };

    });

    list.sort(function (a, b) {

        return a.distance - b.distance;

    });

    if (topN) {

        list = list.slice(0, topN);

    }

    return list;

}
