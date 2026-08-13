/* ==========================================================
   FCSS Ver2.3
   suiri.js
   水利データ（CSV読み込み版）
========================================================== */

/* SUIRIは他ファイル（planner.js等）からそのまま参照されるので、
   配列の"中身"を書き換える形にする（再代入しない） */

var SUIRI = [];

/* ==========================================================
   簡易CSVパーサー
   ダブルクォート内のカンマにも対応
========================================================== */

function parseCSVLine(line){

    var result=[];

    var cur="";

    var inQuotes=false;

    for(var i=0;i<line.length;i++){

        var ch=line[i];

        if(ch === '"'){

            inQuotes = !inQuotes;

        }else if(ch === ',' && !inQuotes){

            result.push(cur);

            cur="";

        }else{

            cur += ch;

        }

    }

    result.push(cur);

    return result;

}

function parseCSV(text){

    /* 改行コードの違い(CRLF/LF)を吸収 */

    var lines = text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");

    lines = lines.filter(function(l){

        return l.trim() !== "";

    });

    if(lines.length < 2){

        return [];

    }

    var header = parseCSVLine(lines[0]).map(function(h){

        return h.trim();

    });

    var rows = [];

    for(var i=1;i<lines.length;i++){

        var cols = parseCSVLine(lines[i]);

        var obj = {};

        for(var j=0;j<header.length;j++){

            obj[header[j]] = cols[j] !== undefined ? cols[j].trim() : "";

        }

        /* 数値項目を変換 */

        obj.lat = Number(obj.lat);

        obj.lng = Number(obj.lng);

        obj.diameter = Number(obj.diameter) || 0;

        obj.capacity = Number(obj.capacity) || 0;

        obj.road = Number(obj.road) || 0;

        rows.push(obj);

    }

    return rows;

}

/* ==========================================================
   CSV読み込み
   cache:"no-store" で常に最新のCSVを取得する
========================================================== */

function loadSuiriData(){

    return fetch("suiri.csv", { cache:"no-store" })

        .then(function(res){

            if(!res.ok){

                throw new Error("suiri.csvの読み込みに失敗しました（" + res.status + "）");

            }

            return res.text();

        })

        .then(function(text){

            var rows = parseCSV(text);

            SUIRI.length = 0;

            rows.forEach(function(r){

                SUIRI.push(r);

            });

            console.log("水利データ読み込み完了：", SUIRI.length, "件");

        })

        .catch(function(err){

            console.error(err);

            alert("水利データ(suiri.csv)の読み込みに失敗しました。ファイルが同じフォルダにあるか確認してください。");

        });

}
