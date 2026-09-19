const DELIVERY_MAYKOP = 400;
const FREE_FROM = 5000;
const STORE_PHONE = '79627657718';
const STORE_ADDRESS = 'Майкоп, ул. Крестьянская, 190';
const fmt = n => Math.round(Number(n) || 0).toLocaleString('ru-RU') + ' ₽';
const CATS = { sun:'Солнцезащитные', vision:'Оправы для зрения', computer:'Для компьютера', accessories:'Чехлы и аксессуары' };
const LENSES = {
  none: {name:'Без линз', price:0},
  standard: {name:'Стандартные линзы', price:1500},
  premium: {name:'Премиум-линзы', price:3000}
};

function safeRead(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
  catch { return fallback; }
}

const PRODUCTS = [
  {id:1,name:'Lacoste — авиатор',cat:'sun',price:9999,old:0,rating:4.9,emoji:'🕶️',badge:'',desc:'Классический золотистый авиатор, поляризация, металлическая оправа.',spec:['Поляризация','Металл'],image:'images/product-1.jpg'},
  {id:2,name:'Солнцезащитные очки — градиент',cat:'sun',price:9999,old:0,rating:4.8,emoji:'🕶️',badge:'',desc:'Городская классика, тёмные линзы, удобная посадка.',spec:['Пластик TR90'],image:'images/product-2.jpg'}
];

function makeLine(productId, options={}) {
  const lens = options.lens || 'none';
  const diopter = lens === 'none' ? '' : (options.diopter || '');
  return { key:`${productId}|${lens}|${diopter}`, productId:Number(productId), qty:Math.max(1, Number(options.qty) || 1), lens, diopter };
}

function normalizeCart(raw) {
  if (Array.isArray(raw)) return raw.filter(x => x && PRODUCTS.some(p=>p.id===Number(x.productId))).map(x=>makeLine(x.productId,x));
  if (raw && typeof raw === 'object') return Object.entries(raw).flatMap(([id,qty]) => PRODUCTS.some(p=>p.id===Number(id)) ? [makeLine(id,{qty})] : []);
  return [];
}

let cart = normalizeCart(safeRead('optika_cart', []));
let orders = safeRead('optika_orders', []);
let reviews = safeRead('optika_reviews', {});
const $ = id => document.getElementById(id);

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function saveCart(){localStorage.setItem('optika_cart',JSON.stringify(cart));}
function toast(t){const e=$('toast');if(!e)return;e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
const cartQty=()=>cart.reduce((sum,line)=>sum+line.qty,0);
const lineLensPrice=line=>LENSES[line.lens]?.price||0;
const linePrice=line=>{const p=PRODUCTS.find(x=>x.id===Number(line.productId));return p?p.price+lineLensPrice(line):0};
const cartSum=()=>cart.reduce((sum,line)=>sum+linePrice(line)*line.qty,0);
const catName=c=>CATS[c]||c;
const imageCandidates=id=>{const p=PRODUCTS.find(x=>x.id===Number(id));const custom=p?.image?[p.image]:[];return [...custom,`images/product-${id}.webp`,`images/product-${id}.jpg`,`images/product-${id}.png`,`images/product-${id}.svg`];};
function imageMarkup(p, className='product-photo') {
  const [first,...rest]=imageCandidates(p.id);
  return `<img class="${className}" src="${first}" alt="${esc(p.name)}" loading="lazy" data-fallback="${esc(JSON.stringify(rest))}" onerror="handleImageError(this)">`;
}
window.handleImageError = function(img){
  try {
    const list=JSON.parse(img.dataset.fallback||'[]');
    if(list.length){img.dataset.fallback=JSON.stringify(list.slice(1));img.src=list[0];return;}
  } catch {}
  const wrap=document.createElement('div');wrap.className='photo-fallback';wrap.textContent='🕶️';img.replaceWith(wrap);
};

function calc(){
  const sum=cartSum();
  const dtype=document.querySelector('input[name=dtype]:checked')?.value||'courier';
  let ship=(dtype==='pickup'||sum===0||sum>=FREE_FROM)?0:DELIVERY_MAYKOP;
  const disc=0;
  return {sum,disc,ship,total:Math.max(0,sum+ship),dtype};
}

function getFiltered(){
  const q=$('search').value.trim().toLowerCase();
  const c=$('catFilter').value;
  const s=$('sort').value;
  let list=PRODUCTS.filter(p=>{
    const hay=[p.name,p.desc,...(p.spec||[])].join(' ').toLowerCase();
    return (c==='all'||p.cat===c)&&(!q||hay.includes(q));
  });
  if(s==='cheap')list.sort((a,b)=>a.price-b.price);else if(s==='exp')list.sort((a,b)=>b.price-a.price);else list.sort((a,b)=>b.rating-a.rating);
  return list;
}

function render(){
  const list=getFiltered();
  $('productGrid').innerHTML=list.map(p=>{
    const rc=(reviews[p.id]||[]).length;
    return `<div class="card">
      <div class="card-visual" onclick="openProduct(${p.id})">${imageMarkup(p)}<span class="card-emoji">${p.emoji}</span></div>
      <div>${p.badge?`<span class="badge">${esc(p.badge)}</span>`:''} <span class="meta">★ ${p.rating}${rc?` (${rc})`:''} · ${catName(p.cat)}</span></div>
      <h3 onclick="openProduct(${p.id})">${esc(p.name)}</h3>
      <div class="price">${fmt(p.price)} ${p.old?`<span class="old">${fmt(p.old)}</span>`:''}</div>
      <div class="card-row"><button class="btn" onclick="openProduct(${p.id})">Подробнее</button><button class="btn btn-dark" onclick="addToCart(${p.id})">В корзину</button></div>
    </div>`;
  }).join('')||'<p>Ничего не найдено. Попробуйте «авиатор», «титан» или «футляр».</p>';
  renderCart();
}

function addToCart(id, options={}){
  const p=PRODUCTS.find(x=>x.id===Number(id));if(!p)return;
  const line=makeLine(id,options);
  const existing=cart.find(x=>x.key===line.key);
  if(existing)existing.qty+=1;else cart.push(line);
  saveCart();renderCart();toast('Товар добавлен в корзину 🛒');
}
function inc(key){const line=cart.find(x=>x.key===key);if(line){line.qty++;saveCart();renderCart();}}
function dec(key){const idx=cart.findIndex(x=>x.key===key);if(idx<0)return;cart[idx].qty--;if(cart[idx].qty<=0)cart.splice(idx,1);saveCart();renderCart();}
function delItem(key){cart=cart.filter(x=>x.key!==key);saveCart();renderCart();}

function cartLineName(line){
  const p=PRODUCTS.find(x=>x.id===Number(line.productId));
  if(!p)return 'Товар';
  const extras=line.lens!=='none' ? ` · ${LENSES[line.lens].name}${line.diopter?` · ${line.diopter} D`:''}` : '';
  return p.name+extras;
}

function renderCart(){
  $('cartCount').textContent=cartQty();
  $('cartItems').innerHTML=cart.length ? cart.map(line=>{
    const p=PRODUCTS.find(x=>x.id===Number(line.productId));
    return `<div class="cart-item"><div class="cart-thumb">${imageMarkup(p,'cart-photo')}<span>${p.emoji}</span></div><div style="flex:1"><b class="cart-name">${esc(cartLineName(line))}</b><div>${fmt(linePrice(line))} за шт.</div><div class="qty"><button onclick="dec('${esc(line.key)}')">−</button><span>${line.qty}</span><button onclick="inc('${esc(line.key)}')">+</button><button class="btn btn-sm" onclick="delItem('${esc(line.key)}')">✕</button></div></div></div>`;
  }).join('') : '<p class="empty">Корзина пуста. Выберите товары в каталоге.</p>';
  const c=calc();
  $('cartTotals').innerHTML=`Товары: <b>${fmt(c.sum)}</b><br>Доставка: <b>${c.ship===0?(c.sum===0?'—':'Бесплатно'):fmt(c.ship)}</b><br>Итого: <b>${fmt(c.total)}</b>`;
  $('checkoutTotals').innerHTML=$('cartTotals').innerHTML;
}

function lensOptions(p){
  if(p.cat!=='vision')return '';
  const opts=Object.entries(LENSES).map(([key,v])=>`<label class="lens-choice"><input type="radio" name="lensChoice" value="${key}" ${key==='none'?'checked':''} onchange="toggleDiopter()"><span>${esc(v.name)}${v.price?` <b>+${fmt(v.price)}</b>`:''}</span></label>`).join('');
  const diopters=['-10','-9.5','-9','-8.5','-8','-7.5','-7','-6.5','-6','-5.5','-5','-4.5','-4','-3.5','-3','-2.5','-2','-1.5','-1','-0.5','+0.5','+1','+1.5','+2','+2.5','+3','+3.5','+4','+4.5','+5','+5.5','+6','+6.5','+7','+7.5','+8','+8.5','+9','+9.5','+10'];
  return `<div class="lens-box"><b>Выберите линзы</b><div class="lens-options">${opts}</div><label id="diopterRow" class="diopter-row" style="display:none">Диоптрии<select id="diopterChoice">${diopters.map(v=>`<option value="${v}">${v} D</option>`).join('')}</select></label><small>Окончательный рецепт можно подтвердить в салоне. Изготовление — 1–3 дня.</small></div>`;
}
window.toggleDiopter=function(){const selected=document.querySelector('input[name=lensChoice]:checked')?.value;const row=$('diopterRow');if(row)row.style.display=selected==='none'?'none':'block';};

function openProduct(id){
  const p=PRODUCTS.find(x=>x.id===Number(id));if(!p)return;
  const list=reviews[id]||[];
  $('productModalBox').innerHTML=`
    <div class="product-detail">
      <div class="product-detail-head">
        <div>
          <span class="product-detail-kicker">${catName(p.cat)}</span>
          <h2>${esc(p.name)}</h2>
          <div class="product-detail-rating">★ ${p.rating} <span>• Артикул ${p.cat.toUpperCase()}-${p.id}</span></div>
        </div>
        <button class="icon-btn product-close" onclick="closeAll()" aria-label="Закрыть">✕</button>
      </div>

      <div class="product-detail-main">
        <div class="product-detail-gallery">
          <div class="product-detail-image">${imageMarkup(p,'product-detail-photo')}<span class="product-detail-emoji">${p.emoji}</span></div>
          <div class="product-detail-trust">
            <span>✓ Проверка качества</span>
            <span>✓ Можно заказать онлайн</span>
          </div>
        </div>

        <div class="product-detail-info">
          ${p.badge?`<span class="badge product-detail-badge">${esc(p.badge)}</span>`:''}
          <p class="product-detail-desc">${esc(p.desc)}</p>

          <div class="product-detail-price">
            <strong>${fmt(p.price)}</strong>
            ${p.old?`<span class="old">${fmt(p.old)}</span><span class="sale-label">Выгода ${fmt(p.old-p.price)}</span>`:''}
          </div>

          <div class="product-detail-section">
            <div class="product-section-title">Характеристики</div>
            <div class="product-spec-grid">
              ${(p.spec||[]).map(s=>`<div class="product-spec-item"><span>✓</span>${esc(s)}</div>`).join('')}
            </div>
          </div>

          ${lensOptions(p)}

          <div class="product-buy-row">
            <div class="product-qty">
              <button type="button" onclick="changeProductQty(-1)">−</button>
              <span id="productQty">1</span>
              <button type="button" onclick="changeProductQty(1)">+</button>
            </div>
            <button class="btn btn-dark product-buy-btn" onclick="addConfiguredProduct(${id});closeAll()">
              ${p.cat==='vision'?'Добавить в корзину':'В корзину'}
            </button>
          </div>

          <div class="product-delivery">
            <div><span>🚚</span><div><b>Доставка по Майкопу</b><small>400 ₽ · бесплатно от 5 000 ₽</small></div></div>
            <div><span>📍</span><div><b>Самовывоз</b><small>${esc(STORE_ADDRESS)} · бесплатно</small></div></div>
          </div>
        </div>
      </div>

      <div class="product-reviews">
        <div class="product-section-title">Отзывы <span>${list.length}</span></div>
        <div class="reviews-list">
          ${list.map(r=>`<div class="rev"><b>${esc(r.n)}</b> · ${'★'.repeat(Math.max(1,Math.min(5,Number(r.s)||5)))}<br>${esc(r.t)}<br><small>${esc(r.d)}</small></div>`).join('')||'<p class="meta">Пока нет отзывов — станьте первым.</p>'}
        </div>
        <div class="rev-form"><input id="rvName" placeholder="Ваше имя" maxlength="40"><select id="rvStars"><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select><textarea id="rvText" rows="2" maxlength="600" placeholder="Ваш отзыв"></textarea><button class="btn" onclick="addReview(${id})">Оставить отзыв</button></div>
      </div>
    </div>`;
  showModal('productModal');
  toggleDiopter();
}

window.changeProductQty=function(delta){
  const el=$('productQty');if(!el)return;
  el.textContent=Math.max(1,Math.min(99,Number(el.textContent||1)+delta));
};

window.addConfiguredProduct=function(id){
  const p=PRODUCTS.find(x=>x.id===Number(id));if(!p)return;
  const lens=p.cat==='vision'?(document.querySelector('input[name=lensChoice]:checked')?.value||'none'):'none';
  const diopter=lens==='none'?'':$('diopterChoice')?.value||'';
  const qty=Math.max(1,Math.min(99,Number($('productQty')?.textContent||1)));
  for(let i=0;i<qty;i++) addToCart(id,{lens,diopter});
};

function addReview(id){
  const n=($('rvName').value.trim()||'Гость').slice(0,40),s=Math.max(1,Math.min(5,Number($('rvStars').value)||5)),t=$('rvText').value.trim().slice(0,600);
  if(!t){toast('Напишите текст отзыва');return;}
  (reviews[id]=reviews[id]||[]).unshift({n,s,t,d:new Date().toLocaleString('ru-RU')});
  localStorage.setItem('optika_reviews',JSON.stringify(reviews));openProduct(id);render();toast('Спасибо за отзыв!');
}

function showModal(id){$(id).classList.add('show');$('overlay').classList.add('show');}
function closeAll(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('show'));$('cartDrawer').classList.remove('open');$('overlay').classList.remove('show');}
function openOrders(){
  $('ordersList').innerHTML=orders.length?orders.map(o=>`<div class="order"><b>${esc(o.num)}</b> · ${esc(o.date)}<br>${esc(o.items)}<br>Итого: <b>${fmt(o.total)}</b><br>${esc(o.name)}, ${esc(o.address||'')} (${esc(o.dtype==='pickup'?'самовывоз':'курьер')})<br>Оплата: ${esc(o.payLabel||'после подтверждения')} </div>`).join(''):'<p>Заказов пока нет.</p>';
  showModal('ordersModal');
}
function updateAddressField(){
  const pickup=document.querySelector('input[name=dtype]:checked')?.value==='pickup';
  const field=$('addressField');
  if(!field)return;
  field.style.display=pickup?'none':'block';
  const input=$('addressInput');
  input.required=!pickup;
  if(pickup)input.value='';
  renderCart();
}
function formatOrderMessage(order){
  return ['Здравствуйте! Хочу оформить заказ в «Оптика Майкоп».','',`Заказ: ${order.num}`,`Товары: ${order.items}`,`Итого: ${fmt(order.total)}`,`Получение: ${order.dtype==='pickup'?'самовывоз':'доставка по Майкопу'}`,order.address?`Адрес: ${order.address}`:'',`Имя: ${order.name}`,`Телефон: ${order.phone}`,`Оплата: ${order.payLabel}`,order.comment?`Комментарий: ${order.comment}`:''].filter(Boolean).join('\n');
}

$('cartBtn').onclick=()=>{renderCart();$('cartDrawer').classList.add('open');$('overlay').classList.add('show')};
$('closeCart').onclick=closeAll;$('overlay').onclick=closeAll;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeAll);
$('ordersBtn').onclick=openOrders;$('adminBtn').onclick=openOrders;
$('clearOrders').onclick=()=>{orders=[];localStorage.setItem('optika_orders','[]');openOrders()};
['search','catFilter','sort'].forEach(id=>$(id).addEventListener('input',render));
document.querySelectorAll('input[name=dtype]').forEach(r=>r.addEventListener('change',updateAddressField));
$('checkoutBtn').onclick=()=>{if(!cartQty()){toast('Корзина пуста');return}renderCart();closeAll();showModal('checkoutModal');updateAddressField()};
$('orderForm').onsubmit=e=>{
  e.preventDefault();
  const f=new FormData(e.target), c=calc();
  if(!cartQty()){toast('Корзина пуста');return;}
  const name=String(f.get('name')||'').trim(),phone=String(f.get('phone')||'').trim(),dtype=String(f.get('dtype')||'courier'),address=String(f.get('address')||'').trim(),comment=String(f.get('comment')||'').trim(),pay=String(f.get('pay')||'upon');
  if(!name||!phone){toast('Заполните имя и телефон');return;}
  if(dtype==='courier'&&!address){toast('Укажите адрес доставки');return;}
  const num='OM-'+Math.floor(1000+Math.random()*9000);
  const items=cart.map(line=>`${cartLineName(line)} × ${line.qty}`).join('; ');
  const payLabel=pay==='online'?'Картой после подтверждения заказа':'Карта / наличные при получении';
  const order={num,date:new Date().toLocaleString('ru-RU'),items,total:c.total,name,phone,address,dtype,payLabel,comment};
  orders.unshift(order);localStorage.setItem('optika_orders',JSON.stringify(orders));
  cart=[];saveCart();e.target.reset();updateAddressField();closeAll();render();openOrders();
  const wa=`https://wa.me/${STORE_PHONE}?text=${encodeURIComponent(formatOrderMessage(order))}`;
  window.open(wa,'_blank','noopener,noreferrer');
  toast(`Заказ ${num} сохранён. Открываем WhatsApp.`);
};

saveCart();
render();
updateAddressField();
