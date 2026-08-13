/* ==========================================================
   FCSS-Simple app.js
   火災発生場所から近隣水利を自動選定して表示するだけの
   シンプルなシステム。部署割当・庁舎連携などは含まない。
========================================================== */

let map;
let fireMarker;
let waterLayer;

window.onload = function () {

    initMap();

    const searchBtn = document.getElementById("searchButton");

    searchBtn.disabled = true;
    searchBtn.innerText = "水利データ読込中...";

    loadSuiriData().then(function () {

        searchBtn.disabled = false;
        searchBtn.innerText = "検索";

        searchBtn.addEventListener("click", searchAddress);

        const addressInput = document.getElementById("address");

        addressInput.addEventListener("keydown", function (e) {

            if (e.key === "Enter") {

                e.preventDefault();

                searchAddress();

            }

        });

        enableMapClick();

        applyUrlParams();

    });

};

/* ==========================================================
   地図初期化
========================================================== */

function initMap() {

    map = L.map("map").setView([34.6937, 135.5023], 14);

    L.tileLayer(

        "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",

        {
            attribution: "地理院タイル",
            maxNativeZoom: 18,
            maxZoom: 20
        }

    ).addTo(map);

    waterLayer = L.layerGroup().addTo(map);

}

/* ==========================================================
   住所検索
========================================================== */

async function searchAddress() {

    const address = document.getElementById("address").value.trim();

    if (address === "") {

        alert("住所を入力してください");

        return;

    }

    try {

        const url = "https://msearch.gsi.go.jp/address-search/AddressSearch?q="
            + encodeURIComponent(address);

        const response = await fetch(url);

        const json = await response.json();

        if (json.length === 0) {

            alert("住所が見つかりません");

            return;

        }

        const lng = json[0].geometry.coordinates[0];
        const lat = json[0].geometry.coordinates[1];

        runSearch(lat, lng);

    } catch (e) {

        console.error(e);

        alert(e.message);

    }

}

/* ==========================================================
   地図クリックでも検索
========================================================== */

function enableMapClick() {

    map.on("click", function (e) {

        runSearch(e.latlng.lat, e.latlng.lng);

    });

}

/* ==========================================================
   URLパラメータ対応
   例: ?lat=34.7215&lng=135.3617&n=5
       ?address=兵庫県西宮市甲子園町1-82
========================================================== */

function applyUrlParams() {

    const params = new URLSearchParams(window.location.search);

    const n = params.get("n");

    if (n) {

        document.getElementById("topN").value = n;

    }

    const lat = params.get("lat");
    const lng = params.get("lng");

    if (lat && lng) {

        runSearch(Number(lat), Number(lng));

        return;

    }

    const address = params.get("address");

    if (address) {

        document.getElementById("address").value = address;

        searchAddress();

    }

}

/* ==========================================================
   火点表示
========================================================== */

function showFire(lat, lng) {

    if (fireMarker) {

        map.removeLayer(fireMarker);

    }

    const fireIcon = L.divIcon({

        html: "<div style='font-size:34px'>🔥</div>",
        className: "",
        iconSize: [34, 34]

    });

    fireMarker = L.marker([lat, lng], { icon: fireIcon })
        .addTo(map)
        .bindPopup("火点")
        .openPopup();

    map.setView([lat, lng], 18);

}

/* ==========================================================
   近隣水利の検索・表示（本体）
   planner.jsのgetAvailableWaterをそのまま利用
   （距離順ソート・class=K除外・blocked/access_from除外込み）
========================================================== */

function runSearch(lat, lng) {

    showFire(lat, lng);

    const topN = Number(document.getElementById("topN").value);

    const all = getAvailableWater(lat, lng);

    const nearest = all.slice(0, topN);

    drawResults(nearest);

    renderList(nearest);

}

function drawResults(list) {

    waterLayer.clearLayers();

    list.forEach(function (w, i) {

        const isTank = (w.type === "防火水槽");

        const color = isTank ? "#2e7d32" : "#1976d2";

        const icon = L.divIcon({

            className: "",
            iconSize: [30, 30],
            iconAnchor: [15, 15],

            html:
                "<div style='"
                + "width:28px;height:28px;border-radius:50%;"
                + "background:" + color + ";"
                + "border:3px solid white;"
                + "box-shadow:0 0 4px rgba(0,0,0,.7);"
                + "display:flex;align-items:center;justify-content:center;"
                + "color:white;font-size:12px;font-weight:bold;"
                + "'>" + (i + 1) + "</div>"

        });

        L.marker([w.lat, w.lng], { icon: icon })

            .bindPopup(
                "<b>" + (i + 1) + "位　" + w.id + "</b><br>"
                + w.type + "（" + (w.class || "") + "）<br>"
                + (w.address || "") + "<br>"
                + "火点から " + Math.round(w.distance) + "m ・ " + w.direction
            )

            .addTo(waterLayer);

    });

}

function renderList(list) {

    const box = document.getElementById("resultList");

    if (list.length === 0) {

        box.innerHTML = "条件に合う水利が見つかりませんでした";

        return;

    }

    let html = "";

    list.forEach(function (w, i) {

        html += `

        <div class="unit">

            <div class="unitNo">${i + 1}</div>

            <div class="unitBody">

                <div>

                    <strong>${w.id}</strong>

                    （${w.type}・${w.class || ""}）

                </div>

                <div>${w.address || ""}</div>

                <div>

                    火点から ${Math.round(w.distance)}m ・ ${w.direction}

                </div>

            </div>

        </div>

        `;

    });

    box.innerHTML = html;

}
