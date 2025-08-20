// ===== Utilities
const $ = (s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const toast=(m)=>{const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t.__to);t.__to=setTimeout(()=>t.classList.remove('show'),3000)};
const notify=(m)=>{const n=$('#notif');const d=document.createElement('div');d.className='notif';d.textContent=m;n.appendChild(d);setTimeout(()=>{d.remove()},4000)}
const saveLS=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const loadLS=(k,def)=>{try{const v=JSON.parse(localStorage.getItem(k)); return v??def}catch{return def}}

// ===== i18n (sederhana)
let LANG=loadLS('LANG','id');
const dict={
  id:{homeTitle:'Tinggal klik, kami jemput & antar.',homeSub:'Pesan laundry terdekat berbasis GPS, chat kurir, dan pembayaran fleksibel.'},
  en:{homeTitle:'Just tap, we pick up & deliver.',homeSub:'Order nearby laundry with GPS tracking, courier chat, and flexible payment.'}
}

// ===== State
let currentView='home';
let orders=[]; 
const statuses=['Dijemput','Diproses','Diantar','Selesai'];
let routePts=[[120,260],[420,160],[120,260]]; // rumah -> laundry -> kembali rumah
let homePt=[120,260];
let laundryPt=[420,160];
let courier={el:null, progress:0, active:false};
let favorites=loadLS('favorites',[]);

const shops=[
  {id:'lz-01',name:'Clean&Fresh Sudirman',dist:1.2,rating:4.8,promo:'Diskon 20%',services:['Kiloan','Express','Sepatu'],logo:'🧴'},
  {id:'lz-02',name:'Laundry Cepat Benhil',dist:0.9,rating:4.6,promo:'Gratis Antar',services:['Kiloan','Jas','Dry Clean'],logo:'⚡'},
  {id:'lz-03',name:'Cerah Cemerlang',dist:2.1,rating:4.9,promo:'Cashback 10%',services:['Kiloan','Sepatu'],logo:'✨'},
  {id:'lz-04',name:'Express Kiloan Suites',dist:1.7,rating:4.5,promo:'Bundle Hemat',services:['Kiloan','Express','Jas'],logo:'🧼'}
];

// ===== Navigation + Ink underline
function moveInk(btn){const ink=$('#ink');const r=btn.getBoundingClientRect();const pr=btn.parentElement.getBoundingClientRect();ink.style.width=r.width+'px';ink.style.left=(r.left-pr.left)+'px'}
function navigate(v,animate=true){currentView=v;render(animate);$$('#mainMenu button').forEach(b=>{b.classList.toggle('active',b.dataset.view===v); if(b.dataset.view===v) moveInk(b)});}

// ===== Theme & Lang with persistence
const themeToggle=$('#themeToggle');
function applyTheme(){document.body.setAttribute('data-theme', themeToggle.checked?'dark':'light'); saveLS('THEME_DARK',themeToggle.checked)}
themeToggle.addEventListener('change',applyTheme);
$('#langBtn').addEventListener('click',()=>{LANG=LANG==='id'?'en':'id'; $('#langBtn').textContent = LANG==='id'?'🇮🇩 ID':'🇬🇧 EN'; saveLS('LANG',LANG); render();});

// ===== Shared rendering helpers
function animateCards(){ $$('.card').forEach((c,i)=> setTimeout(()=>c.classList.add('show'),80*i) ); }
function star(n){return '★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));}

// ===== Pages
function render(animate=true){
  const app=$('#app');
  if(currentView==='home') {
    app.innerHTML=`<section class='grid cols-2 ${animate?'slide':''}' style='margin-top:20px'>
      <div class='card'>
        <h1>${dict[LANG].homeTitle}</h1>
        <h2>${dict[LANG].homeSub}</h2>
        <div class='grid cols-4' style='margin-top:14px'>
          ${[
            {t:'Kiloan',i:'🧺'},{t:'Express',i:'⚡'},{t:'Cuci Sepatu',i:'👟'},{t:'Cuci Jas',i:'🤵'},{t:'Dry Clean',i:'🧥'},{t:'Setrika',i:'🧯'},{t:'Bed Cover',i:'🛏️'},{t:'Karpet',i:'🧽'}
          ].map(s=>`<div class='pill'><span>${s.i}</span><b>${s.t}</b></div>`).join('')}
        </div>
        <button class='btn' style='margin-top:14px' onclick="navigate('order')">Mulai Pesan</button>
      </div>
      <div class='card'>
        <h3>Laundry Rekomendasi Dekat Anda</h3>
        <div class='grid cols-2' style='margin-top:6px'>
          ${shops.map(sh=>shopCard(sh)).join('')}
        </div>
      </div>
    </section>`;
    attachFavHandlers();
  }

  if(currentView==='order'){
    app.innerHTML=`<div class='grid cols-2 ${animate?'slide':''}' style='margin-top:20px'>
      <div class='card'>
        <h1>Pemesanan</h1>
        <div class='field'><label>Layanan</label>
          <select id='service' class='input'>
            <option>Kiloan</option>
            <option>Express</option>
            <option>Satuan</option>
            <option>Cuci Sepatu</option>
            <option>Cuci Jas</option>
            <option>Dry Clean</option>
          </select>
        </div>
        <div class='field'><label>Alamat</label><input id='address' class='input' placeholder='Alamat lengkap'></div>
        <div class='field'><label>Jadwal</label><input type='date' id='date' class='input'></div>
        <div class='field'><label>Metode Pembayaran</label><select id='pay' class='input'><option>Transfer</option><option>E-Wallet</option><option>COD</option></select></div>
        <div class='field'><label>Catatan</label><textarea id='note' class='input' placeholder='Preferensi parfum, lipatan, dll.'></textarea></div>
        <div class='row' style='margin-top:6px'>
          <button class='btn' onclick='makeOrder()'>Konfirmasi Pesan</button>
          <button class='btn secondary' onclick='togglePay(true)'>Simulasi Pembayaran</button>
        </div>
      </div>
      <div class='card'>
        <h3>Simulasi Biaya</h3>
        <div class='field'><label>Berat (kg) / Item</label><input id='kg' class='input' type='number' min='1' value='5'></div>
        <div class='field'><label>Jenis</label><select id='jenis' class='input'>
          <option>Reguler</option><option>Express</option><option>Sepatu</option><option>Jas</option><option>Dry Clean</option>
        </select></div>
        <div class='notice' id='calc'>Perkiraan: Rp0</div>
        <button class='btn secondary' style='margin-top:10px' onclick='calcPrice()'>Hitung</button>
        <div class='reward' style='margin-top:12px'>
          <span class='badge'>Level: <b id='levelBadge'>Bronze</b></span>
          <div style='flex:1'>
            <div class='progress'><div class='progress-bar' id='rewardBar'></div></div>
            <small class='muted'>Poin: <b id='points'>0</b> / 100</small>
          </div>
        </div>
      </div>
    </div>`;
    updateRewardUI();
  }

  if(currentView==='profile'){
    const sh=shops.find(s=>s.id===window.__profileId);
    if(!sh){navigate('home');return}
    app.innerHTML=`<div class='grid cols-2 ${animate?'slide':''}' style='margin-top:20px'>
      <div class='card'>
        <div class='row'>
          <div class='pill'><span style='font-size:1.4rem'>${sh.logo}</span><b>${sh.name}</b></div>
          <button class='btn icon' data-fav='${sh.id}'>${isFav(sh.id)?'❤️':'🤍'}</button>
        </div>
        <p class='chip' style='margin-top:6px'>${sh.dist} km • ⭐ ${sh.rating} • ${sh.promo}</p>
        <h3 style='margin-top:10px'>Layanan</h3>
        <div class='grid cols-4' style='margin-top:6px'>${sh.services.map(s=>`<div class='pill'>${iconFor(s)}<b>${s}</b></div>`).join('')}</div>
        <div class='row' style='margin-top:12px; gap:10px'>
          <button class='btn' onclick="prefillShop('${sh.name}')">Pesan di sini</button>
          <button class='btn secondary' onclick="openLaundryChat('${sh.id}','${sh.name}')">Chat Laundry</button>
        </div>
      </div>
      <div class='card'>
        <h3>Ulasan</h3>
        <div class='notice'>“Rapi, wangi, tepat waktu!” — 1.2k ulasan</div>
        <h3 style='margin-top:10px'>Harga (dummy)</h3>
        <div class='grid cols-2'>
          <div class='notice'>Kiloan: Rp7.000/kg<br>Express: Rp10.000/kg</div>
          <div class='notice'>Sepatu: Rp25.000/psg<br>Jas/Dry Clean: Rp40.000/item</div>
        </div>
      </div>
    </div>`;
    attachFavHandlers();
  }

  // NEW: Pesanan page
  if(currentView==='orders'){
    app.innerHTML = `
      <div class="card ${animate?'slide':''}" style="margin-top:20px">
        <h1>Pesanan Saya</h1>
        ${orders.length ? orders.map((order, idx) => `
          <div class="card" style="margin-bottom:10px">
            <div><b>ID:</b> ${order.id} • <span class="status">${statuses[order.statusIdx||0]}</span></div>
            <div><b>Layanan:</b> ${order.service}</div>
            <div><b>Alamat:</b> ${order.address}</div>
            <button class="btn secondary" onclick="showOrderDetail(${idx})">Lacak</button>
          </div>
        `).join('') : '<div class="notice">Belum ada pesanan.</div>'}
      </div>
      <div id="orderDetail"></div>
    `;
  }

  animateCards();

  // Detail tracking for an order (shown below the list in Pesanan)
  // The UI is injected by showOrderDetail(idx) so does not need a render case

  if(currentView==='promos'){
    app.innerHTML=`<div class='grid cols-3 ${animate?'slide':''}' style='margin-top:20px'>
      ${[
        {c:'WELCOME50',d:'Diskon 50% order pertama.'},
        {c:'EXPRESS10',d:'Diskon 10% layanan express.'},
        {c:'BUNDLEFREE',d:'Gratis jemput-antar untuk paket langganan.'}
      ].map(p=>`<div class='card'><h3>${p.c}</h3><p>${p.d}</p><button class='btn secondary' onclick="toast('Promo ${p.c} digunakan')">Gunakan</button></div>`).join('')}
    </div>`;
  }

  if(currentView==='subscription'){
    app.innerHTML=`<div class='grid cols-3 ${animate?'slide':''}' style='margin-top:20px'>
      <div class='card'><h3>Paket Hemat</h3><p>Rp99rb/bln</p><p class='chip'>4x kiloan + antar</p><button class='btn' onclick="toast('Langganan Paket Hemat aktif')">Langganan</button></div>
      <div class='card'><h3>Paket Hemat 20</h3><p>Rp179rb/bln</p><p class='chip'>8x kiloan + 1x express</p><button class='btn' onclick="toast('Langganan Paket Hemat 20 aktif')">Langganan</button></div>
      <div class='card'><h3>Kantoran</h3><p>Rp499rb/bln</p><p class='chip'>Kuota 25kg + laporan</p><button class='btn' onclick="toast('Langganan Paket Kantoran aktif')">Langganan</button></div>
    </div>`;
  }

  if(currentView==='favorites'){
    const favs=shops.filter(s=>favorites.includes(s.id));
    app.innerHTML=`<div class='card ${animate?'slide':''}' style='margin-top:20px'>
      <h1>Favorit</h1>
      <div class='grid cols-2' style='margin-top:10px'>${favs.length?favs.map(s=>shopCard(s)).join(''):'<div class="notice">Belum ada favorit.</div>'}</div>
    </div>`; attachFavHandlers();
  }

  if(currentView==='support'){
    app.innerHTML=`<div class='grid cols-2 ${animate?'slide':''}' style='margin-top:20px'>
      <div class='card'><h1>FAQ</h1>
        <details open><summary>Bagaimana cara pesan?</summary><p>Pilih menu Pesan, isi detail, konfirmasi.</p></details>
        <details><summary>Metode pembayaran?</summary><p>Transfer, e-wallet, COD.</p></details>
        <details><summary>Pelacakan & ETA?</summary><p>Lihat menu Pesanan. Rute: rumah → laundry → kembali rumah.</p></details>
      </div>
      <div class='card'><h1>Kontak</h1>
        <div class='field'><label>Email</label><input class='input'></div>
        <div class='field'><label>Pesan</label><textarea class='input'></textarea></div>
        <button class='btn' style='margin-top:10px' onclick="toast('Pesan terkirim!')">Kirim</button>
      </div>
    </div>`;
  }
}

// ===== Helpers UI
function iconFor(s){const map={Kiloan:'🧺',Express:'⚡',Sepatu:'👟','Cuci Sepatu':'👟','Cuci Jas':'🤵','Dry Clean':'🧥','Jas':'🤵'};return `<span>${map[s]||'🧼'}</span>`}

function shopCard(sh){return `<div class='card shop-card'>
  <div class='row'><div class='pill'><span style='font-size:1.4rem'>${sh.logo}</span><b>${sh.name}</b></div>
  <button class='btn icon' data-fav='${sh.id}'>${isFav(sh.id)?'❤️':'🤍'}</button></div>
  <div class='row'><span>⭐ ${sh.rating}</span><span>${sh.dist} km</span></div>
  <div class='chip'>${sh.promo}</div>
  <div class='row' style='gap:10px'>
    <button class='btn secondary' onclick="openProfile('${sh.id}')">Lihat Profil</button>
    <button class='btn secondary' onclick="openLaundryChat('${sh.id}','${sh.name}')">Chat</button>
  </div>
</div>`}

function isFav(id){return favorites.includes(id)}
function toggleFav(id){ if(isFav(id)) favorites=favorites.filter(x=>x!==id); else favorites.push(id); saveLS('favorites',favorites); render(false); }
function attachFavHandlers(){ $$('[data-fav]').forEach(b=> b.onclick=()=>toggleFav(b.getAttribute('data-fav')) ); }

// ===== Order, Reward & Calculator
let rewardPts=loadLS('rewardPts',0);
function updateRewardUI(){ const level= rewardPts>=300?'Gold':rewardPts>=150?'Silver':'Bronze'; $('#levelBadge').textContent=level; $('#points').textContent=rewardPts; $('#rewardBar').style.width= (rewardPts%100)+'%'; }
function addReward(n){ rewardPts+=n; saveLS('rewardPts',rewardPts); updateRewardUI(); }

function makeOrder(){
  const id='LZ-'+Math.floor(Math.random()*100000);
  orders.push({id,service:$('#service').value,address:$('#address').value,statusIdx:0});
  toast('Pesanan '+id+' dibuat');
  addReward(10);
  courier.progress=0; courier.active=false; // reset perjalanan
  navigate('orders');
  notify('Kurir menerima pesanan 🚚');
}

function calcPrice(){
  const qty=parseFloat($('#kg').value||0); const jenis=$('#jenis').value; let price=0;
  if(jenis==='Reguler') price=qty*7000; else if(jenis==='Express') price=qty*10000; else if(jenis==='Sepatu') price=qty*25000; else if(jenis==='Jas') price=qty*40000; else if(jenis==='Dry Clean') price=qty*40000;
  price=Math.max(0, Math.round(price/1000)*1000); $('#calc').textContent='Perkiraan: Rp'+ price.toLocaleString('id-ID');
}

// ===== Profile helpers
function openProfile(id){ window.__profileId=id; navigate('profile'); }
function prefillShop(name){ navigate('order'); setTimeout(()=>{ $('#address').value=name+' (ambil di toko)'; toast('Alamat diisi dari profil: '+name); },50); }

// ===== Tracking for orders (shown from Pesanan)
function showOrderDetail(idx){
  const order = orders[idx];
  // Set up tracking state for this order (simulate a courier progress per order)
  let progress = order.progress??0;
  let active = false;
  let rideTimer = null;

  // DOM for map & tracking
  $('#orderDetail').innerHTML = `
    <div class="card" style="margin-top:18px">
      <h2>Lacak Pesanan ${order.id}</h2>
      <span class="status" id="statusBadge">${statuses[order.statusIdx||0]}</span>
      <div class="steps">${[0,1,2,3].map(i=>`<div class="step" data-step="${i}"></div>`).join('')}</div>
      <div class="progress"><div class="progress-bar" id="prog"></div></div>
      <div class="map" id="map_${order.id}">
        <div class="gridline"></div>
        <svg class="route" viewBox="0 0 800 340" preserveAspectRatio="none">
          <polyline id="routeMain_${order.id}" fill="none" stroke="var(--blue-2)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="marker poi" id="home_${order.id}" style="left:${homePt[0]}px;top:${homePt[1]}px">🏠</div>
        <div class="marker poi" id="laundry_${order.id}" style="left:${laundryPt[0]}px;top:${laundryPt[1]}px">🧺</div>
        <div class="marker" id="truck_${order.id}">🚚</div>
        <div class="eta" id="eta_${order.id}">ETA: — menit</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
        <button class="btn secondary" id="startRide_${order.id}">Mulai Rute</button>
        <button class="btn secondary" id="pauseRide_${order.id}">Jeda</button>
        <button class="btn secondary" id="resetRide_${order.id}">Reset</button>
      </div>
      <h3 style="margin-top:18px">Chat Kurir</h3>
      <div class="chat">
        <div class="chat-log" id="chatLog_${order.id}"></div>
        <div class="chat-input">
          <input id="chatTxt_${order.id}" class="input" placeholder="Tulis pesan ke kurir...">
          <button class="btn" id="sendMsg_${order.id}">Kirim</button>
        </div>
      </div>
    </div>
  `;

  // Tracking logic for this order instance
  let routePtsO=[homePt,[ (homePt[0]+laundryPt[0])/2, (homePt[1]+laundryPt[1])/2 - 20],laundryPt,[ (homePt[0]+laundryPt[0])/2, (homePt[1]+laundryPt[1])/2 + 10],homePt];
  function routeLength(pts){ let L=0; for(let i=0;i<pts.length-1;i++){const a=pts[i], b=pts[i+1]; L+=Math.hypot(b[0]-a[0], b[1]-a[1]); } return L; }
  function pointAt(pts,t){ const total=routeLength(pts); let d=t*total; for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1]; const seg=Math.hypot(b[0]-a[0], b[1]-a[1]); if(d<=seg){ const r=d/seg; return [a[0]+(b[0]-a[0])*r, a[1]+(b[1]-a[1])*r]; } d-=seg; } return pts[pts.length-1]; }
  function positionOnRoute(el,pts,t){ const [x,y]=pointAt(pts,t); el.style.left=x+'px'; el.style.top=y+'px'; }
  const BASE_PX_PER_MIN=140; // 140 px ≈ 1 menit

  function updateRoutes(){
    $('#routeMain_'+order.id).setAttribute('points', routePtsO.map(pt=>pt.join(',')).join(' '));
    positionOnRoute($('#truck_'+order.id), routePtsO, progress);
  }
  function updateProgressUI(){ 
    const p=Math.min(100, Math.round(progress*100));
    $('#prog').style.width=(p)+'%';
    const steps=$$('#orderDetail .step');
    const badge=$('#statusBadge');
    // Status berdasar progress di rute bolak-balik
    let label=statuses[0];
    let idxStatus = 0;
    if(p<45){ label=statuses[0]; idxStatus=0;} // menuju laundry
    else if(p>=45 && p<55){ label=statuses[1]; idxStatus=1;} // di laundry
    else if(p>=55 && p<100){ label=statuses[2]; idxStatus=2;} // menuju rumah
    else { label=statuses[3]; idxStatus=3;}
    badge.textContent=label;
    steps.forEach((s,i)=> s.classList.toggle('done', (i*33) <= p));
    order.statusIdx = idxStatus; // update status for list
  }
  function updateETA(manual=false){
    const total=routeLength(routePtsO); const remaining=(1-progress)*total; const speed=BASE_PX_PER_MIN; // px per minute
    const min=Math.max(1, Math.round(remaining/speed));
    $('#eta_'+order.id).textContent=`ETA: ${min} menit`;
    if(manual) notify('ETA diperbarui: '+min+' menit');
  }
  // Start, pause, reset events
  function startRide(){
    clearInterval(rideTimer); active=true; notify('Kurir sedang menuju laundry 🚚');
    rideTimer=setInterval(()=>{
      const speed=0.01; // progress per tick (konstan)
      if(active){
        progress=Math.min(1,progress+speed);
        positionOnRoute($('#truck_'+order.id), routePtsO, progress);
        updateETA();
        updateProgressUI();
        order.progress = progress; // persist progress per order
        if(progress>0.48 && progress<0.52 && !startRide.__hitLaundry){ notify('Cucian sedang diproses di laundry 🧺'); startRide.__hitLaundry=true; }
        if(progress>0.9 && !startRide.__almostHome){ notify('Kurir hampir sampai rumah 🚪'); startRide.__almostHome=true; }
        if
