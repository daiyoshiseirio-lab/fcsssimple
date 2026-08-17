/* ==========================================================
   FCSS-Simple app.js
   火災発生場所から近隣水利を自動選定して表示するだけの
   シンプルなシステム。部署割当・庁舎連携などは含まない。
========================================================== */

let map;
let fireMarker;
let allWaterLayer;
let highlightLayer;

window.onload = function () {

    initMap();

    initTabs();

    const searchBtn = document.getElementById("searchButton");

    searchBtn.disabled = true;
    searchBtn.innerText = "水利データ読込中...";

    Promise.all([

        loadSuiriData(),
        loadStationData()

    ]).then(function () {

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

        /* 登録されている全水利を常時表示する */

        drawAllWater();

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

    allWaterLayer = L.layerGroup().addTo(map);
    highlightLayer = L.layerGroup().addTo(map);

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
   タブ切り替え（地図・近隣水利一覧・近隣消防署一覧）
   Excelのシートタブのように、1つずつ切り替えて表示する
========================================================== */

function initTabs() {

    const tabBtns = document.querySelectorAll(".tab-btn");

    tabBtns.forEach(function (btn) {

        btn.addEventListener("click", function () {

            const target = btn.dataset.tab;

            document.querySelectorAll(".tab-btn").forEach(function (b) {

                b.classList.toggle("active", b === btn);

            });

            document.querySelectorAll(".tab-panel").forEach(function (panel) {

                panel.classList.toggle("active", panel.id === "tabPanel-" + target);

            });

            /* 地図タブに切り替えたときは、非表示中にずれたサイズを再計算する */

            if (target === "map" && map) {

                setTimeout(function () {

                    map.invalidateSize();

                }, 50);

            }

        });

    });

}

/* ==========================================================
   地図タップで火点指定（誤操作防止のため単発モード）
   「地図タップで火点指定」ボタンを押した直後の1回だけ、
   地図タップが火点移動として反応する。それ以外の閲覧中の
   タップ（誤操作や、水利を確認するための操作）では反応しない。
========================================================== */

let mapClickArmed = false;

function enableMapClick() {

    map.on("click", function (e) {

        if (!mapClickArmed) {

            return;

        }

        mapClickArmed = false;

        updateArmButton();

        runSearch(e.latlng.lat, e.latlng.lng);

    });

    const armBtn = document.getElementById("armMapClickBtn");

    if (armBtn) {

        armBtn.addEventListener("click", function () {

            mapClickArmed = !mapClickArmed;

            updateArmButton();

        });

    }

}

function updateArmButton() {

    const armBtn = document.getElementById("armMapClickBtn");

    if (!armBtn) {

        return;

    }

    if (mapClickArmed) {

        armBtn.textContent = "📍 地図をタップして火点を指定（有効）";
        armBtn.classList.add("active");

    } else {

        armBtn.textContent = "📍 地図タップで火点を指定する";
        armBtn.classList.remove("active");

    }

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

    drawHighlight(nearest);

    renderList(nearest);

    /* 消防署一覧（地図マーカーなし、文字情報のみ） */

    const nearestStations = getNearestStations(lat, lng, topN);

    renderStationList(nearestStations);

}

/* ==========================================================
   消防署一覧の描画（文字情報のみ）
========================================================== */

function renderStationList(list) {

    const box = document.getElementById("stationList");

    if (!box) {

        return;

    }

    if (list.length === 0) {

        box.innerHTML = "消防署データが登録されていません";

        return;

    }

    let html = "";

    list.forEach(function (s, i) {

        html += `

        <div class="unit">

            <div class="unitNo">${i + 1}</div>

            <div class="unitBody">

                <div>

                    <strong>${s.name || s.id || ""}</strong>

                </div>

                <div>${s.address || ""}</div>

                <div>

                    火点から直線約 ${Math.round(s.distance)}m

                    ${s.memo ? "・" + s.memo : ""}

                </div>

            </div>

        </div>

        `;

    });

    box.innerHTML = html;

}

/* ==========================================================
   ラベル文字列（口径・番号・T/P/K）
========================================================== */

function waterLabelParts(w) {

    const parts = [];

    if (w.id) parts.push(w.id);

    const isTank = (w.type === "防火水槽");

    if (w.diameter && !isTank && Number(w.diameter) > 0) {

        parts.push(w.diameter + "mm");

    }

    if (w.capacity && isTank && Number(w.capacity) > 0) {

        parts.push(w.capacity + "t");

    }

    if (w.class) parts.push(w.class);

    return parts;

}

function waterLabelText(w) {

    return waterLabelParts(w).join(" / ");

}

/* ==========================================================
   登録されている全水利を常時表示
   （口径・番号・T/P/Kを常時ラベル表示。小さめのアイコン）
========================================================== */

function drawAllWater() {

    allWaterLayer.clearLayers();

    SUIRI.forEach(function (w) {

        const isTank = (w.type === "防火水槽");

        const color = isTank ? "#2e7d32" : (w.class === "K" ? "#9e9e9e" : "#1976d2");

        const letter = isTank ? "水" : (w.class || "?");

        const icon = L.divIcon({

            className: "",
            iconSize: [22, 22],
            iconAnchor: [11, 11],

            html:
                "<div style='"
                + "width:20px;height:20px;border-radius:50%;"
                + "background:" + color + ";"
                + "border:2px solid white;"
                + "box-shadow:0 0 3px rgba(0,0,0,.6);"
                + "display:flex;align-items:center;justify-content:center;"
                + "color:white;font-size:9px;font-weight:bold;"
                + "'>" + letter + "</div>"

        });

        const marker = L.marker([w.lat, w.lng], { icon: icon });

        const label = waterLabelText(w);

        if (label) {

            marker.bindTooltip(label, {
                permanent: true,
                direction: "right",
                offset: [8, 0],
                className: "suiri-label"
            });

        }

        marker.bindPopup(
            "<b>" + (w.id || "") + "</b><br>"
            + w.type + "（" + (w.class || "") + "）<br>"
            + (w.address || "")
        );

        marker.addTo(allWaterLayer);

    });

}

/* ==========================================================
   直近N件のハイライト表示
   （大きめのアイコン＋順位番号＋口径・番号・T/P/Kラベル）
========================================================== */

function drawHighlight(list) {

    highlightLayer.clearLayers();

    list.forEach(function (w, i) {

        const isTank = (w.type === "防火水槽");

        const color = isTank ? "#2e7d32" : "#d32f2f";

        const icon = L.divIcon({

            className: "",
            iconSize: [36, 36],
            iconAnchor: [18, 18],

            html:
                "<div style='"
                + "width:34px;height:34px;border-radius:50%;"
                + "background:" + color + ";"
                + "border:4px solid #ffeb3b;"
                + "box-shadow:0 0 8px rgba(0,0,0,.8);"
                + "display:flex;align-items:center;justify-content:center;"
                + "color:white;font-size:15px;font-weight:bold;"
                + "'>" + (i + 1) + "</div>"

        });

        const marker = L.marker([w.lat, w.lng], { icon: icon, zIndexOffset: 1000 });

        const labelParts = waterLabelParts(w);

        const label = labelParts.join(" / ");

        marker.bindTooltip(label, {
            permanent: true,
            direction: "right",
            offset: [10, 0],
            className: "suiri-label suiri-label-highlight"
        });

        marker.bindPopup(
            "<b>" + (i + 1) + "位　" + w.id + "</b><br>"
            + w.type + "（" + (w.class || "") + "）<br>"
            + (w.address || "") + "<br>"
            + "火点から " + Math.round(w.distance) + "m ・ " + w.direction
        )

            .addTo(highlightLayer);

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
