const TEAM_ALIASES={
  'arizona-cardinals':'ARI','atlanta-falcons':'ATL','baltimore-ravens':'BAL','buffalo-bills':'BUF',
  'carolina-panthers':'CAR','chicago-bears':'CHI','cincinnati-bengals':'CIN','cleveland-browns':'CLE',
  'dallas-cowboys':'DAL','denver-broncos':'DEN','detroit-lions':'DET','green-bay-packers':'GB',
  'houston-texans':'HOU','indianapolis-colts':'IND','jacksonville-jaguars':'JAX','kansas-city-chiefs':'KC',
  'las-vegas-raiders':'LV','los-angeles-chargers':'LAC','la-chargers':'LAC','los-angeles-rams':'LAR','la-rams':'LAR',
  'miami-dolphins':'MIA','minnesota-vikings':'MIN','new-england-patriots':'NE','new-orleans-saints':'NO',
  'new-york-giants':'NYG','new-york-jets':'NYJ','philadelphia-eagles':'PHI','pittsburgh-steelers':'PIT',
  'san-francisco-49ers':'SF','seattle-seahawks':'SEA','tampa-bay-buccaneers':'TB','tennessee-titans':'TEN',
  'washington-commanders':'WAS'
};

export function token(value){return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
export function teamAbbr(value){const t=token(value);return TEAM_ALIASES[t]||String(value||'').trim().toUpperCase()||null}

export function matchNflFixture(game,fixtures,{maxTimeDeltaHours=6}={}){
  const kickoff=Date.parse(game?.startTimePacific||'');
  if(!Number.isFinite(kickoff))return null;
  const maxDelta=maxTimeDeltaHours*3600000;
  const candidates=(fixtures||[]).filter(f=>Number(f?.tournamentId)===31&&Number.isFinite(Date.parse(f?.startTime||''))&&Math.abs(Date.parse(f.startTime)-kickoff)<=maxDelta);
  const exact=candidates.find(f=>teamAbbr(f?.participant1Name)===game.home&&teamAbbr(f?.participant2Name)===game.away);
  if(exact)return{fixture:exact,matchedBy:'home-away+kickoff'};
  const unordered=candidates.find(f=>new Set([teamAbbr(f?.participant1Name),teamAbbr(f?.participant2Name)]).size===2&&[teamAbbr(f?.participant1Name),teamAbbr(f?.participant2Name)].includes(game.home)&&[teamAbbr(f?.participant1Name),teamAbbr(f?.participant2Name)].includes(game.away));
  return unordered?{fixture:unordered,matchedBy:'participant-pair+kickoff'}:null;
}

function parseHandle(handle){
  const raw=String(handle||'').trim().toLowerCase();
  let m=raw.match(/^([+-]?\d+(?:\.\d+)?)\/(home|away)$/);
  if(m)return{line:Number(m[1]),side:m[2]};
  m=raw.match(/^(home|away)\/([+-]?\d+(?:\.\d+)?)$/);
  if(m)return{line:Number(m[2]),side:m[1]};
  return null;
}
function quoteTime(q){for(const v of [q?.bookmakerChangedAt,q?.changedAt]){const t=Date.parse(v||'');if(Number.isFinite(t))return t}return 0}
function americanNumber(value){const n=Number(String(value??'').trim().replace(/^\+/,''));return Number.isFinite(n)&&Math.abs(n)>=100?n:null}

export function extractPinnacleHomeSpread(fixture,observerGeneratedAt=null){
  const book=fixture?.pinnacle;
  if(!book||book.bookmakerIsActive===false||book.suspended===true)return null;
  const candidates=[];
  for(const market of book.markets||[]){
    if(market?.marketActive===false)continue;
    const label=String(market?.bookmakerMarketId||'').toLowerCase();
    if(label.includes('moneyline')||label.includes('/totals')||label.includes('total/'))continue;
    let home=null,away=null;
    for(const outcome of market?.outcomes||[]){
      for(const q of outcome?.players||[]){
        if(q?.active===false)continue;
        const parsed=parseHandle(q?.bookmakerOutcomeId);
        if(!parsed)continue;
        if(parsed.side==='home')home={...q,line:parsed.line};
        if(parsed.side==='away')away={...q,line:parsed.line};
      }
    }
    if(!home||!away||!Number.isFinite(home.line)||!Number.isFinite(away.line))continue;

    // OddsPapi currently encodes many Pinnacle spreads with the same signed
    // handicap on both side handles (for example -3.5/home and -3.5/away).
    // The side token identifies the selection and the numeric handle is the
    // home-perspective market line. Keep compatibility with feeds that expose
    // traditional opposite-signed side handles as well.
    const sameSignedEncoding=Math.abs(home.line-away.line)<=0.01;
    const oppositeSignedEncoding=Math.abs(home.line+away.line)<=0.01;
    if(!sameSignedEncoding&&!oppositeSignedEncoding)continue;

    const limits=[Number(home.limit),Number(away.limit)].filter(Number.isFinite);
    const limitScore=limits.length===2?Math.min(...limits):limits.length===1?limits[0]:-1;
    const mainLineScore=(home.mainLine===true?1:0)+(away.mainLine===true?1:0);
    const balanceScore=Math.abs(Number(home.price)-Number(away.price));
    const observedMs=Math.max(quoteTime(home),quoteTime(away),Date.parse(fixture?.updatedAt||'')||0,Date.parse(observerGeneratedAt||'')||0);
    candidates.push({
      homeSpread:home.line,
      homePriceAmerican:home.priceAmerican??null,
      awayPriceAmerican:away.priceAmerican??null,
      homeLimit:Number.isFinite(Number(home.limit))?Number(home.limit):null,
      awayLimit:Number.isFinite(Number(away.limit))?Number(away.limit):null,
      marketId:String(market?.marketId||''),
      bookmakerMarketId:market?.bookmakerMarketId||null,
      observedAt:observedMs?new Date(observedMs).toISOString():observerGeneratedAt,
      mainLineScore,
      limitScore,
      balanceScore:Number.isFinite(balanceScore)?balanceScore:999,
      lineEncoding:sameSignedEncoding?'ODDSPAPI_HOME_PERSPECTIVE':'OPPOSITE_SIGNED_SIDES',
      selectionMethod:'mainline_then_highest-two-sided-limit_then_price-balance'
    });
  }
  candidates.sort((a,b)=>b.mainLineScore-a.mainLineScore||b.limitScore-a.limitScore||a.balanceScore-b.balanceScore||String(a.marketId).localeCompare(String(b.marketId)));
  return candidates[0]||null;
}

export function extractPinnacleMoneyline(fixture,observerGeneratedAt=null){
  const book=fixture?.pinnacle;
  if(!book||book.bookmakerIsActive===false||book.suspended===true)return null;
  const candidates=[];
  for(const market of book.markets||[]){
    if(market?.marketActive===false)continue;
    const label=String(market?.bookmakerMarketId||'').toLowerCase();
    if(!label.includes('moneyline'))continue;
    let home=null,away=null;
    for(const outcome of market?.outcomes||[]){
      for(const q of outcome?.players||[]){
        if(q?.active===false)continue;
        const side=String(q?.bookmakerOutcomeId||'').trim().toLowerCase();
        if(side!=='home'&&side!=='away')continue;
        const priceAmerican=americanNumber(q?.priceAmerican);
        if(priceAmerican===null)continue;
        const candidate={...q,priceAmerican};
        if(side==='home')home=candidate;
        if(side==='away')away=candidate;
      }
    }
    if(!home||!away)continue;
    const limits=[Number(home.limit),Number(away.limit)].filter(Number.isFinite);
    const limitScore=limits.length===2?Math.min(...limits):limits.length===1?limits[0]:-1;
    const mainLineScore=(home.mainLine===true?1:0)+(away.mainLine===true?1:0);
    const actualObservedMs=Math.max(quoteTime(home),quoteTime(away),Date.parse(fixture?.updatedAt||'')||0);
    const observedMs=actualObservedMs||(Date.parse(observerGeneratedAt||'')||0);
    candidates.push({
      homeMoneylineAmerican:home.priceAmerican,
      awayMoneylineAmerican:away.priceAmerican,
      homeLimit:Number.isFinite(Number(home.limit))?Number(home.limit):null,
      awayLimit:Number.isFinite(Number(away.limit))?Number(away.limit):null,
      marketId:String(market?.marketId||''),
      bookmakerMarketId:market?.bookmakerMarketId||null,
      observedAt:observedMs?new Date(observedMs).toISOString():observerGeneratedAt,
      limitScore,
      mainLineScore,
      observedMs,
      selectionMethod:'highest-two-sided-limit_then-mainline_then-freshness'
    });
  }
  candidates.sort((a,b)=>b.limitScore-a.limitScore||b.mainLineScore-a.mainLineScore||b.observedMs-a.observedMs||String(a.marketId).localeCompare(String(b.marketId)));
  const selected=candidates[0]||null;
  if(!selected)return null;
  const {observedMs,...result}=selected;
  return result;
}
