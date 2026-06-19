let countriesData = [], map, mapMarkers = [], chart, historicalChart, efficiencyChart;
let mapMetric = "cases";

// Dark mode toggle
document.getElementById('darkModeBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    renderMap();
});

// Gradient helper
function getGradient(ctx, colors, height=400) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c));
    return gradient;
}

// Fetch global stats
async function fetchGlobal() {
    const res = await fetch("/api/global");
    const data = await res.json();
    if (data.error) return document.getElementById("globalStats").innerText = data.error;

    document.getElementById("globalStats").innerHTML = `
    <div class="col-md-3"><div class="card bg-primary text-white p-3"><h5>Total Cases</h5><p>${data.cases.toLocaleString()}</p></div></div>
    <div class="col-md-3"><div class="card bg-danger text-white p-3"><h5>Total Deaths</h5><p>${data.deaths.toLocaleString()}</p></div></div>
    <div class="col-md-3"><div class="card bg-success text-white p-3"><h5>Total Recovered</h5><p>${data.recovered.toLocaleString()}</p></div></div>
    <div class="col-md-3"><div class="card bg-info text-white p-3"><h5>Total Vaccinated</h5><p>${data.tests?.toLocaleString() || 'N/A'}</p></div></div>`;
}

// Fetch country data
async function fetchCountries() {
    const res = await fetch("/api/countries");
    const data = await res.json();
    if (data.error) return document.getElementById("topBottomTables").innerText = data.error;

    countriesData = data.map(c => ({
        ...c,
        vaccinated: c.tests || 0,
        vulnerability: (c.cases / c.population) * 100 + (1 - (c.vaccinated / c.population)) * 100
    }));

    populateCountrySelector();
    renderTopBottom();
    renderMap();
    renderTimeSeriesChart();
    renderEfficiencyChart();
}

// Populate country selector
function populateCountrySelector() {
    const selector = document.getElementById('countrySelector');
    selector.innerHTML = `<option value="">Select a country</option>` +
        countriesData.map(c => `<option value="${c.country}">${c.country}</option>`).join('');
    selector.addEventListener('change', e => {
        const country = countriesData.find(c => c.country === e.target.value);
        if (country) showCountryStats(country);
    });
}

// Show country stats & historical chart
async function showCountryStats(country) {
    document.getElementById('countryStats').innerHTML = `
        <div class="card p-3 mb-3">
            <h5>${country.country}</h5>
            <p>Cases: ${country.cases.toLocaleString()}</p>
            <p>Deaths: ${country.deaths.toLocaleString()}</p>
            <p>Recovered: ${country.recovered.toLocaleString()}</p>
            <p>Population: ${country.population.toLocaleString()}</p>
            <p>Vaccinated: ${country.vaccinated.toLocaleString()}</p>
            <p>Vulnerability Index: ${country.vulnerability.toFixed(2)}</p>
        </div>`;
    fetchHistoricalChart(country.country);
}

// Top/bottom countries
function renderTopBottom() {
    const top5 = [...countriesData].sort((a, b) => b.cases - a.cases).slice(0, 5);
    const bottom5 = [...countriesData].sort((a, b) => a.cases - b.cases).slice(0, 5);
    document.getElementById("topBottomTables").innerHTML = `
        <h4>Top 5 Affected Countries</h4>
        <ul class="list-group">${top5.map(c => `<li class="list-group-item"><img class="flag" src="${c.countryInfo.flag}">${c.country}: ${c.cases.toLocaleString()}</li>`).join('')}</ul>
        <h4>Least 5 Affected Countries</h4>
        <ul class="list-group">${bottom5.map(c => `<li class="list-group-item"><img class="flag" src="${c.countryInfo.flag}">${c.country}: ${c.cases.toLocaleString()}</li>`).join('')}</ul>`;
}

// Render Map
function renderMap() {
    if (!map) {
        map = L.map('map').setView([20, 0], 2);
        L.tileLayer(document.body.classList.contains('dark-mode') ?
            'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' :
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            { maxZoom: 19 }).addTo(map);
    }

    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    countriesData.forEach(c => {
        if (c.countryInfo.lat && c.countryInfo.long) {
            let value = mapMetric === "cases" ? c.cases : c.vaccinated;
            let colorScale = mapMetric === "cases" ? ['#ff9999','#ff0000'] : ['#b3ffb3','#00b300'];
            let circle = L.circle([c.countryInfo.lat, c.countryInfo.long], {
                radius: Math.sqrt(value)/500,
                color: colorScale[1],
                fillColor: colorScale[1],
                fillOpacity: 0.6,
                weight: 1
            }).addTo(map);
            circle.bindTooltip(`${c.country}: ${value.toLocaleString()}`);
            mapMarkers.push(circle);
        }
    });
}

// Map metric toggle
document.getElementById('toggleMapMetric').addEventListener('change', e => {
    mapMetric = e.target.checked ? "vaccinated" : "cases";
    renderMap();
});

// Time Series Chart
function renderTimeSeriesChart() {
    const ctx = document.getElementById('timeSeriesChart').getContext('2d');
    const topCountries = countriesData.sort((a,b)=>b.cases-a.cases).slice(0,10);
    if(chart) chart.destroy();
    const gradient = getGradient(ctx,['#42a5f5','#478ed1','#1e3c72']);
    chart = new Chart(ctx,{
        type:'bar',
        data:{ labels: topCountries.map(c=>c.country), datasets:[{ label:'Total Cases', data:topCountries.map(c=>c.cases), backgroundColor:gradient, borderRadius:12 }]},
        options:{
            responsive:true,
            maintainAspectRatio:false,
            animation:{ duration:1200, easing:'easeOutQuart' },
            plugins:{ legend:{ display:false }, tooltip:{ mode:'index', intersect:false, callbacks:{ label: ctx=>ctx.raw.toLocaleString() }}},
            scales:{ x:{ grid:{ display:false }}, y:{ beginAtZero:true, grid:{ color:'rgba(0,0,0,0.05)' }, ticks:{ callback: v=>v.toLocaleString() } } }
        }
    });
}

// Efficiency Chart
function renderEfficiencyChart() {
    const ctx = document.getElementById('efficiencyChart').getContext('2d');
    const topVaccinated = countriesData.sort((a,b)=> (b.vaccinated/b.population)-(a.vaccinated/a.population)).slice(0,10);
    if(efficiencyChart) efficiencyChart.destroy();
    const gradient = getGradient(ctx,['#00e676','#00b300','#004d00']);
    efficiencyChart = new Chart(ctx,{
        type:'bar',
        data:{ labels:topVaccinated.map(c=>c.country), datasets:[{ label:'Vaccination Efficiency (%)', data:topVaccinated.map(c=>((c.vaccinated/c.population)*100).toFixed(2)), backgroundColor:gradient, borderRadius:12 }]},
        options:{
            responsive:true,
            maintainAspectRatio:false,
            animation:{ duration:1300, easing:'easeOutQuart' },
            plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: ctx=>ctx.raw+'%' } } },
            scales:{ x:{ grid:{ display:false } }, y:{ beginAtZero:true, max:100, ticks:{ callback:v=>v+'%' }, grid:{ color:'rgba(0,0,0,0.05)' } } }
        }
    });
}

// Historical Line Chart with 7-day Forecast
async function fetchHistoricalChart(country) {
    const res = await fetch(`/api/historical/${country}`);
    const data = await res.json();
    if(data.error) return;

    const cases = data.timeline.cases;
    const dates = Object.keys(cases);
    const values = Object.values(cases);

    const n = values.length;
    const x = Array.from({length:n},(_,i)=>i);
    const y = values;
    const sumX = x.reduce((a,b)=>a+b,0);
    const sumY = y.reduce((a,b)=>a+b,0);
    const sumXY = x.reduce((a,b,i)=>a+b*y[i],0);
    const sumXX = x.reduce((a,b)=>a+b*b,0);
    const slope = (n*sumXY - sumX*sumY)/(n*sumXX - sumX*sumX);
    const intercept = (sumY - slope*sumX)/n;
    const forecast = [];
    for(let i=0;i<7;i++) forecast.push(Math.round(intercept+slope*(n+i)));

    const ctx = document.getElementById('historicalChart').getContext('2d');
    if(historicalChart) historicalChart.destroy();
    const gradient = getGradient(ctx,['rgba(255,99,132,0.6)','rgba(255,99,132,0.1)'],300);

    historicalChart = new Chart(ctx,{
        type:'line',
        data:{ labels:[...dates,...Array.from({length:7},(_,i)=>`+${i+1}d`)], datasets:[{ label:`${country} Cases (7-day forecast)`, data:[...values,...forecast], borderColor:'rgba(255,99,132,1)', backgroundColor:gradient, fill:true, tension:0.4, pointRadius:4, pointHoverRadius:6 }]},
        options:{ responsive:true, maintainAspectRatio:false, animation:{ duration:1400, easing:'easeOutQuart' }, plugins:{ legend:{ display:true }, tooltip:{ mode:'index', intersect:false } }, scales:{ y:{ beginAtZero:true, ticks:{ callback:value=>value.toLocaleString() }, grid:{ color:'rgba(0,0,0,0.05)' } }, x:{ ticks:{ font:{ size:12 } }, grid:{ color:'rgba(0,0,0,0.05)' } } } }
    });
}

// Init
async function init(){ await fetchGlobal(); await fetchCountries(); }
window.addEventListener('DOMContentLoaded', init);
setInterval(init,300000);