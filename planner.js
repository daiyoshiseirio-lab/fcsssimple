/* ==========================================================
   定数
========================================================== */

const MAX_DISTANCE = 1000;     // 水利検索半径(m)
const ANGLE_LIMIT = 90;        // 最低方位差(度)
const BOOST_DISTANCE = 120;    // 中間加圧判定距離(m)
function getAvailableWater(fireLat,fireLng){

    console.log("fire =", fireLat, fireLng);

    let result=[];

    SUIRI.forEach(function(s){

        if(s.class==="K"){

            return;

        }

        /* 壁・水路等で恒久的に使用不可 */

        if(s.blocked && s.blocked.trim()!==""){

            return;

        }

        const d=getDistance(

            fireLat,
            fireLng,
            s.lat,
            s.lng

        );

        console.log(s.id,d);

        if(d>MAX_DISTANCE){

            return;

        }

        const b=getBearing(

            fireLat,
            fireLng,
            s.lat,
            s.lng

        );

        /* 進入方向の制約チェック
           access_from例： "南:5,北"
           → 火点から見て水利が南5m以内、または北（無制限）にある場合のみ使用可 */

        if(s.access_from && s.access_from.trim()!==""){

            if(!checkAccessFrom(s.access_from, b, d)){

                return;

            }

        }

        result.push({

            ...s,

            distance:d,

            bearing:b,

            direction:bearingName(b),

            hose:hoseCount(d)

        });

    });

    result.sort(function(a,b){

        return a.distance-b.distance;

    });

    return result;

}
/* ==========================================================
   進入方向の制約判定
   access_from書式： "南:5,北" のようにカンマ区切り。
   各項目は "方角" または "方角:上限距離(m)"。
   いずれか1つでも条件を満たせば使用可（OR判定）。
========================================================== */

const DIRECTION_CENTER = {

    "北":0, "北東":45, "東":90, "南東":135,

    "南":180, "南西":225, "西":270, "北西":315

};

function bearingMatchesDirection(bearing, dirName){

    const center = DIRECTION_CENTER[dirName];

    if(center===undefined){

        return false;

    }

    /* 方角名の担当範囲は±22.5° */

    return angleDiff(bearing, center) <= 22.5;

}

function checkAccessFrom(accessFromStr, bearing, distance){

    const rules = accessFromStr.split(",");

    for(let i=0;i<rules.length;i++){

        const rule = rules[i].trim();

        if(rule===""){

            continue;

        }

        const parts = rule.split(":");

        const dirName = parts[0].trim();

        const maxDist = parts[1] ? Number(parts[1].trim()) : null;

        if(!bearingMatchesDirection(bearing, dirName)){

            continue;

        }

        if(maxDist!==null && distance>maxDist){

            continue;

        }

        /* この項目の条件を満たした */

        return true;

    }

    /* どの項目にも該当しなかった */

    return false;

}
/* ==========================================================
   水利選定
========================================================== */

function selectWaters(list){

    let used=[];
    let result=[];

    if(list.length===0){

        return result;

    }

    /* １番水利 */

    result.push(list[0]);
    used.push(list[0].id);

    /* ２番水利（90°以上離す） */

    let second=null;

    for(let i=1;i<list.length;i++){

        if(used.includes(list[i].id)){

            continue;

        }

        if(

            angleDiff(

                list[0].bearing,

                list[i].bearing

            )>=ANGLE_LIMIT

        ){

            second=list[i];

            break;

        }

    }

    if(second===null){

        for(let i=1;i<list.length;i++){

            if(!used.includes(list[i].id)){

                second=list[i];

                break;

            }

        }

    }

    if(second){

        result.push(second);

        used.push(second.id);

    }

    /* ３番水利 */

    for(let i=0;i<list.length;i++){

        if(used.includes(list[i].id)){

            continue;

        }

        result.push(list[i]);
        used.push(list[i].id);

        break;

    }

    /* ４番水利 */

    for(let i=0;i<list.length;i++){

        if(used.includes(list[i].id)){

            continue;

        }

        result.push(list[i]);
        used.push(list[i].id);

        break;

    }

    return result;

}
/* ==========================================================
   部署計画
========================================================== */

function createDispatchPlan(fireLat,fireLng,dispatchCount){

    const waters=getAvailableWater(

        fireLat,
        fireLng

    );

    const selected=selectWaters(waters);

    let plan=[];

    if(selected.length===0){

        return plan;

    }

    const w1=selected[0];

    /* ======================================================
       １・２番着
    ====================================================== */

    if(w1.class==="P"){

        plan.push({

            unit:1,
            car:"T",
            action:"火点部署",
            water:w1

        });

        if(w1.distance>BOOST_DISTANCE){

            plan.push({

                unit:2,
                car:"T",
                action:"中間加圧",
                water:w1

            });

        }else{

            plan.push({

                unit:2,
                car:"T",
                action:"水利部署",
                water:w1

            });

        }

    }else{

        plan.push({

            unit:1,
            car:"T",
            action:"水利部署",
            water:w1

        });

        plan.push({

            unit:2,
            car:"T",
            action:"相がかり",
            water:w1

        });

    }

    /* ======================================================
       ３番着
    ====================================================== */

    if(dispatchCount>=3 && selected.length>=2){

        plan.push({

            unit:3,
            car:"P",
            action:"水利部署",
            water:selected[1]

        });

    }
        /* ======================================================
       ４番着
    ====================================================== */

    if(dispatchCount>=4 && selected.length>=2){

        plan.push({

            unit:4,
            car:"P",
            action:"相がかり",
            water:selected[1]

        });

    }

    /* ======================================================
       ５番着
    ====================================================== */

    if(dispatchCount>=5 && selected.length>=3){

        plan.push({

            unit:5,
            car:"P",
            action:"水利部署",
            water:selected[2]

        });

    }

    /* ======================================================
       ６番着
    ====================================================== */

    if(dispatchCount>=6 && selected.length>=4){

        plan.push({

            unit:6,
            car:"P",
            action:"水利部署",
            water:selected[3]

        });

    }

    /* ======================================================
       ７番着
    ====================================================== */

    if(dispatchCount>=7){

        if(selected.length>=4){

            plan.push({

                unit:7,
                car:"P",
                action:"相がかり",
                water:selected[3]

            });

        }else if(selected.length>=3){

            plan.push({

                unit:7,
                car:"P",
                action:"相がかり",
                water:selected[2]

            });

        }

    }

    return plan;

}
/* ==========================================================
   planner 実行
========================================================== */

/* ==========================================================
   着順に庁舎を紐付ける
   直線距離で決めた到着順位と、部署計画の着順を対応させる
========================================================== */

function attachStations(plan,arrival){

    plan.forEach(function(p){

        var st=null;

        arrival.forEach(function(a){

            if(a.order===p.unit){

                st=a;

            }

        });

        if(!st){

            return;

        }

        p.stationName = st.name;

        p.eta = st.eta;

        p.stationDistance = st.distance;

        /* 計画上の車種と、実際に配置されている車種の食い違いを記録 */

        p.plannedCar = p.car;

        p.actualCar = st.car;

        p.carMismatch = (p.car !== st.car);

    });

    return plan;

}

function runPlanner(fireLat,fireLng,dispatchCount){

    const plan=createDispatchPlan(

        fireLat,
        fireLng,
        dispatchCount

    );

    /* 到着順位を算出して庁舎を紐付ける */

    var arrival = getArrivalOrder(

        fireLat,

        fireLng,

        dispatchCount

    );

    attachStations(plan,arrival);

    showStations(arrival);

    let html="";

    plan.forEach(function(p){

        var nameLabel = p.stationName
                        ? p.stationName
                        : (p.unit + "番隊");

        var etaLabel = p.eta
                       ? "（参考 約" + p.eta + "分）"
                       : "";

        var mismatch = p.carMismatch
                       ? "<div style='color:#c62828;font-size:11px'>※計画は"
                         + p.plannedCar + "車／配置は" + p.actualCar + "車</div>"
                       : "";

        html+=`

        <div class="unit">

            <div class="unitNo">

                🚒${p.unit}

            </div>

            <div class="unitBody">

                <div>

                    <strong>${nameLabel}</strong>

                    ${etaLabel}

                </div>

                ${mismatch}

                <div>

                    <strong>${p.car}車</strong>

                    ${p.action}

                </div>

                <div>

                    ${p.water.id}

                    （${p.water.type}）

                </div>

                <div>

                    ${p.water.address}

                </div>

                <div>

                    火点から

                    ${Math.round(p.water.distance)}m

                    ・

                    ${p.water.direction}

                </div>

                <div>

                    ホース約

                    ${p.water.hose}本

                </div>

            </div>

        </div>

        `;

    });

    document.getElementById("plan").innerHTML=html;

    return plan;

}
/* ==========================================================
   方位差計算
========================================================== */

function angleDiff(a,b){

    let d=Math.abs(a-b);

    if(d>180){

        d=360-d;

    }

    return d;

}

/* ==========================================================
   方位名称
========================================================== */

function bearingName(b){

    if(b>=337.5 || b<22.5){

        return "北";

    }

    if(b<67.5){

        return "北東";

    }

    if(b<112.5){

        return "東";

    }

    if(b<157.5){

        return "南東";

    }

    if(b<202.5){

        return "南";

    }

    if(b<247.5){

        return "南西";

    }

    if(b<292.5){

        return "西";

    }

    return "北西";

}

/* ==========================================================
   ホース本数
========================================================== */

function hoseCount(distance){

    return Math.max(

        1,

        Math.ceil(distance/20)

    );

}
/* ==========================================================
   距離計算
========================================================== */

function getDistance(lat1,lng1,lat2,lng2){

    const R=6378137;

    const dLat=(lat2-lat1)*Math.PI/180;
    const dLng=(lng2-lng1)*Math.PI/180;

    const a=

        Math.sin(dLat/2)*Math.sin(dLat/2)+

        Math.cos(lat1*Math.PI/180)*

        Math.cos(lat2*Math.PI/180)*

        Math.sin(dLng/2)*

        Math.sin(dLng/2);

    const c=

        2*

        Math.atan2(

            Math.sqrt(a),

            Math.sqrt(1-a)

        );

    return R*c;

}

/* ==========================================================
   方位角計算
========================================================== */

function getBearing(lat1,lng1,lat2,lng2){

    const y=

        Math.sin(

            (lng2-lng1)*Math.PI/180

        )*

        Math.cos(

            lat2*Math.PI/180

        );

    const x=

        Math.cos(

            lat1*Math.PI/180

        )*

        Math.sin(

            lat2*Math.PI/180

        )

        -

        Math.sin(

            lat1*Math.PI/180

        )*

        Math.cos(

            lat2*Math.PI/180

        )*

        Math.cos(

            (lng2-lng1)*Math.PI/180

        );

    let b=

        Math.atan2(y,x)*180/Math.PI;

    b=(b+360)%360;

    return b;

}
/* ==========================================================
   planner.js End
========================================================== */

console.log("planner.js loaded");
/* ==========================================================
   無線文作成
========================================================== */

function createRadio(plan){

    let text="";

    plan.forEach(function(p){

        var name = p.stationName
                   ? p.stationName
                   : (p.unit+"番");

        text+=

            name+" "

            +p.car+"車 "

            +p.water.id+" "

            +p.action+"、";

    });

    return text;

}

/* ==========================================================
   部隊色
========================================================== */

function getUnitColor(unit){

    switch(unit){

        case 1:

            return "#d32f2f";

        case 2:

            return "#ef5350";

        case 3:

            return "#1976d2";

        case 4:

            return "#42a5f5";

        case 5:

            return "#388e3c";

        case 6:

            return "#7cb342";

        case 7:

            return "#f57c00";

        default:

            return "#616161";

    }

}
/* ==========================================================
   地図表示用データ
========================================================== */

function createMapData(plan){

    let list=[];

    plan.forEach(function(p){

        list.push({

            unit:p.unit,

            car:p.car,

            action:p.action,

            lat:p.water.lat,

            lng:p.water.lng,

            color:getUnitColor(p.unit),

            water:p.water

        });

    });

    return list;

}

/* ==========================================================
   planner.js End
========================================================== */
