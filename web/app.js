const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const userId = tg?.initDataUnsafe?.user?.id || 0;

async function checkServer(){
  const el=document.getElementById('status');
  if(!el) return;
  try{
    const r=await fetch('/health');
    const d=await r.json();
    el.textContent=d.status==='ok'?'● Онлайн':'⚠ Ошибка';
    el.style.color=d.status==='ok'?'#36cf59':'#ff4b4b';
    el.style.background=d.status==='ok'?'#13281a':'#321923';
  }catch(e){
    el.textContent='⚠ Нет связи';
  }
}
checkServer();
const content = document.getElementById('content');

const money = n => `${Number(n||0).toFixed(2)}`;
const fmtDate = s => new Date(s).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

function calcPage(){
content.innerHTML=`<div class="card">
<div class="label">Параметры сделки</div>
<div class="grid">
<div class="field"><span>🪙 Цена покупки</span><input id="buy" type="number" step="0.01" placeholder="0.00"></div>
<div class="field"><span>💸 Цена продажи</span><input id="sell" type="number" step="0.01" placeholder="0.00"></div>
<div class="field wide"><span>💵 Сумма в фиате</span><input id="fiat" type="number" step="0.01" placeholder="0.00"></div>
<div class="field"><span>📉 Ком. покупки %</span><input id="bc" type="number" step="0.01" placeholder="0.00"></div>
<div class="field"><span>📈 Ком. продажи %</span><input id="sc" type="number" step="0.01" placeholder="0.00"></div>
</div></div>
<button class="primary" onclick="calculate()">✅ Рассчитать</button>
<div id="result"></div>`;
}
async function calculate(){
const data={telegram_id:userId,buy_price:+buy.value,sell_price:+sell.value,fiat_amount:+fiat.value,buy_commission:+bc.value||0,sell_commission:+sc.value||0};
const r=await fetch('/api/calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(x=>x.json());
document.getElementById('result').innerHTML=`<div class="card result ${r.profit>=0?'green':'red'}">Результат: ${money(r.profit)}<div style="font-size:13px;color:#8b98ad;margin-top:8px">Спред ${money(r.spread)}%</div></div>`;
}
function guaranteePage(){
content.innerHTML=`<div class="card"><div class="label">🛡 Гарант сделки</div><p class="muted">Введите сумму сделки и процент прибыли — бот сразу покажет заработок и итоговую сумму.</p><div class="grid">
<div class="field wide"><span>💰 Сумма сделки</span><input id="gamount" type="number" step="0.01" placeholder="10000"></div>
<div class="field"><span>💱 Валюта</span><select id="gcur"><option>RUB</option><option>TON</option><option>USDT</option><option>USD</option><option>BTC</option><option>ETH</option></select></div>
<div class="field"><span>📈 Прибыль %</span><input id="gpct" type="number" step="0.01" placeholder="5"></div>
</div></div><button class="primary" onclick="calculateGuarantee()">🧮 Рассчитать прибыль</button><div id="gresult"></div>`;
}
function calculateGuarantee(){
const amount=Number(document.getElementById('gamount').value||0), pct=Number(document.getElementById('gpct').value||0), cur=document.getElementById('gcur').value;
if(amount<=0){alert('Укажите сумму сделки');return;}
const profit=amount*pct/100, total=amount+profit;
document.getElementById('gresult').innerHTML=`<div class="card result ${profit>=0?'green':'red'}"><div class="label">Результат</div><div class="big">${money(profit)} ${cur}</div><div class="row">Сумма сделки <b>${money(amount)} ${cur}</b></div><div class="row">Процент <b>${money(pct)}%</b></div><div class="row">Итого после сделки <b>${money(total)} ${cur}</b></div></div>`;
}
async function statsPage(){
const s=await fetch('/api/stats/'+userId).then(x=>x.json());
content.innerHTML=`<div class="statgrid">${[['СЕГОДНЯ',s.today],['НЕДЕЛЯ',s.week],['МЕСЯЦ',s.month]].map(([t,v])=>`<div class="stat"><small>${t}</small><strong class="${v.profit>=0?'green':'red'}">${v.profit>=0?'+':''}${money(v.profit)}</strong><small>${v.orders} ед.</small></div>`).join('')}</div>
<div class="summary"><div class="label">Сводка</div>
<div class="row">Всего заработано <b>+${money(s.total_profit)}</b></div>
<div class="row">Всего ордеров <b>${s.orders}</b></div>
<div class="row">Средний спред <b>${money(s.month.avg_spread)}%</b></div>
<div class="row">Потери (комиссии) <b class="red">${money(s.losses)}</b></div></div>
<button class="danger" onclick="clearHistory()">🗑 Сбросить все подсчёты</button>`;
}
async function clearHistory(){if(confirm('Удалить историю?')){await fetch('/api/history/'+userId,{method:'DELETE'});statsPage();}}
async function goalPage(){
const g=await fetch('/api/goal/'+userId).then(x=>x.json());
if(!g.set){content.innerHTML=`<div class="card empty"><div class="ico">🎯</div><h3>Цель не установлена</h3><p>Поставьте цель и следите за прогрессом</p><button class="primary" onclick="setGoal()">Поставить цель</button></div>`;return;}
const pct=Math.min(100,g.target?g.current/g.target*100:0);
content.innerHTML=`<div class="card goalbox"><div class="label">${g.title}</div><h2>${money(g.current)} / ${money(g.target)}</h2><div class="progress"><i style="width:${pct}%"></i></div><div class="green">${pct.toFixed(0)}%</div><button class="primary" style="margin-top:18px;width:100%" onclick="setGoal()">Изменить цель</button></div>`;
}
async function setGoal(){
const title=prompt('Название цели','Моя цель'); if(title===null)return;
const target=+prompt('Целевая сумма','1000'); if(!target)return;
const current=+prompt('Текущий результат','0')||0;
await fetch('/api/goal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telegram_id:userId,title,target,current})}); goalPage();
}
async function linksPage(){content.innerHTML=`<div class="card empty links"><div class="ico">🔗</div><h3>Связок пока нет</h3><p>Скоро здесь появятся готовые схемы</p></div>`}

async function nftPage(){
const rows=await fetch('/api/nft/'+userId).then(x=>x.json());
content.innerHTML=`<div class="card"><div class="label">NFT сделка</div><div class="grid">
<div class="field wide"><span>💎 Название NFT</span><input id="nname" placeholder="Telegram Gift"></div>
<div class="field"><span>🟢 Купил за</span><input id="nbuy" type="number" step="0.0001" placeholder="0.00"></div>
<div class="field"><span>Валюта</span><select id="nbuycur"><option>TON</option><option>USD</option><option>RUB</option></select></div>
<div class="field"><span>🔴 Продал за</span><input id="nsell" type="number" step="0.0001" placeholder="0.00"></div>
<div class="field"><span>Валюта</span><select id="nsellcur"><option>TON</option><option>USD</option><option>RUB</option></select></div>
<div class="field wide"><span>🔗 Ссылка на NFT</span><input id="nlink" type="url" placeholder="https://t.me/..."></div>
</div></div><button class="primary" onclick="saveNFT()">💎 Сохранить NFT</button>
<div class="card"><div class="label">История NFT</div>${rows.length?rows.map(r=>`<div class="history-item"><div class="history-head"><b>${r.name}</b><span class="profit ${r.profit>=0?'green':'red'}">${r.profit>=0?'+':''}${money(r.profit)} ${r.sell_currency}</span></div><div class="history-meta">Купил: ${money(r.buy_price)} ${r.buy_currency} · Продал: ${money(r.sell_price)} ${r.sell_currency} · ${fmtDate(r.created_at)}</div>${r.link?`<a class="linkbtn" href="${r.link}" target="_blank" rel="noopener">🔗 Открыть NFT</a>`:''}</div>`).join(''):'<div class="empty"><div class="ico">💎</div><h3>NFT пока нет</h3><p>Добавьте первую NFT-сделку.</p></div>'}</div>`;
}
async function saveNFT(){
const data={telegram_id:userId,name:nname.value||'NFT',buy_price:+nbuy.value||0,buy_currency:nbuycur.value,sell_price:+nsell.value||0,sell_currency:nsellcur.value,link:nlink.value||''};
if(!data.buy_price||!data.sell_price){alert('Укажите цену покупки и продажи');return;}
await fetch('/api/nft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); nftPage();
}

async function exchangePage(){
content.innerHTML=`<div class="card"><div class="label">💱 Калькулятор обмена</div><div class="grid">
<div class="field"><span>🏦 Сервис</span><select id="eservice"><option>Send</option><option>xRocket</option><option>Своя комиссия</option></select></div>
<div class="field"><span>📋 Тип комиссии</span><select id="etype"><option value="taker">Taker</option><option value="maker">Maker</option><option value="custom">Своя</option></select></div>
<div class="field"><span>💰 Сумма</span><input id="eamount" type="number" step="0.000001" placeholder="1000"></div>
<div class="field"><span>📤 Из</span><select id="efrom"><option>USD</option><option>RUB</option><option>TON</option><option>USDT</option><option>BTC</option><option>ETH</option></select></div>
<div class="field"><span>📥 В</span><select id="eto"><option>TON</option><option>USD</option><option>RUB</option><option>USDT</option><option>BTC</option><option>ETH</option></select></div>
<div class="field"><span>📈 Комиссия %</span><input id="efee" type="number" step="0.01" placeholder="0.75"></div>
<div class="field wide"><span>🔄 Курс: сколько валюты получишь за 1 единицу</span><input id="erate" type="number" step="0.00000001" placeholder="0.00"></div>
<div class="field wide"><span>💳 Что делать с комиссией</span><select id="emode"><option value="subtract">Вычесть из суммы</option><option value="add">Добавить сверху</option></select></div>
</div><div class="muted">Для Send: Exchange — 0.75% taker / 0.5% maker. P2P Market — 0% покупателю / 1% продавцу. У xRocket комиссии зависят от операции — при необходимости укажите свою.</div></div>
<button class="primary" onclick="calculateExchange()">🧮 Рассчитать обмен</button><div id="eresult"></div>`;
setExchangeFee();
}
function setExchangeFee(){
const s=document.getElementById('eservice').value,t=document.getElementById('etype').value;
let fee='';
if(s==='Send') fee=t==='taker'?'0.75':t==='maker'?'0.5':'';
if(s==='xRocket') fee='';
document.getElementById('efee').value=fee;
}
async function calculateExchange(){
const amount=Number(eamount.value||0), fee=Number(efee.value||0), rate=Number(erate.value||0);
if(amount<=0||rate<=0){alert('Укажите сумму и курс');return;}
const data={telegram_id:userId,service:eservice.value,fee_type:etype.value,amount,from_currency:efrom.value,to_currency:eto.value,rate,commission:fee,fee_mode:emode.value};
const r=await fetch('/api/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(x=>x.json());
if(r.error){alert(r.error);return;}
const spentLabel=r.fee_mode==='add'?`К оплате с комиссией <b>${money(r.total_spent)} ${r.from_currency}</b>`:`После комиссии <b>${money(r.net)} ${r.from_currency}</b>`;
document.getElementById('eresult').innerHTML=`<div class="card result green"><div class="label">Результат обмена</div><div class="big">${money(r.received)} ${r.to_currency}</div><div class="row">Комиссия <b>${money(r.fee)} ${r.from_currency} (${money(r.commission)}%)</b></div><div class="row">Курс <b>1 ${r.from_currency} = ${money(r.rate)} ${r.to_currency}</b></div><div class="row">${spentLabel}</div></div>`;
}

async function ratesPage(){
const r=await fetch('/api/rates').then(x=>x.json());
if(r.error){content.innerHTML=`<div class="card empty"><div class="ico">💱</div><h3>Курс временно недоступен</h3><p>Попробуйте ещё раз.</p></div>`;return;}
const ch=r.change24h||0;
content.innerHTML=`<div class="card rate"><div class="label">Актуальный курс</div><h2>💎 ${r.symbol}</h2><div class="big">$${money(r.usd)}</div><div class="rub">${money(r.rub)} ₽</div><div class="${ch>=0?'green':'red'}">${ch>=0?'+':''}${money(ch)}% за 24ч</div><div class="muted">Источник: ${r.source}<br>Обновляется при открытии раздела.</div></div>`;
}

async function historyPage(){
const rows=await fetch('/api/history/'+userId).then(x=>x.json());
content.innerHTML=`<div class="card"><div class="label">История расчётов</div>${rows.length?rows.map(r=>`<div class="history-item"><div class="history-head"><b>${money(r.buy)} → ${money(r.sell)}</b><span class="profit ${r.profit>=0?'green':'red'}">${r.profit>=0?'+':''}${money(r.profit)}</span></div><div class="history-meta">${money(r.fiat)} ₽ · спред ${money(r.spread)}% · ${fmtDate(r.created_at)}</div></div>`).join(''):'<div class="empty"><div class="ico">🕘</div><h3>История пуста</h3><p>Сделайте первый расчёт — он появится здесь.</p></div>'}</div>`;
}
function openPage(p){
document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
({calc:calcPage,guarantee:guaranteePage,stats:statsPage,goal:goalPage,links:linksPage,nft:nftPage,history:historyPage,rates:ratesPage,exchange:exchangePage}[p])();
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>openPage(b.dataset.page));
document.addEventListener('change',e=>{if(e.target.id==='eservice'||e.target.id==='etype')setExchangeFee();});
openPage('calc');
