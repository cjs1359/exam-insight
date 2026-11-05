import sys
from playwright.sync_api import sync_playwright
B=sys.argv[1]; SH='/workspace/exam-insight/shots/'
OVL="""()=>{const els=[...document.querySelectorAll('h1,h2,h3,p,li,span,b,button,td,th,.lab,label')].filter(e=>e.offsetParent&&e.innerText.trim()&&!e.querySelector('h1,h2,p,li,button,td'));let bad=[];
for(const e of els){if(e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflow==='visible'&&getComputedStyle(e).display!=='inline')bad.push('overflow:'+e.innerText.slice(0,20))}
const r=els.map(e=>[e,e.getBoundingClientRect()]);for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const[a,A]=r[i],[b,Bb]=r[j];if(a.contains(b)||b.contains(a))continue;const x=Math.min(A.right,Bb.right)-Math.max(A.left,Bb.left),y=Math.min(A.bottom,Bb.bottom)-Math.max(A.top,Bb.top);if(x>3&&y>3)bad.push(a.innerText.slice(0,15)+' ⟂ '+b.innerText.slice(0,15))}return bad.slice(0,10)}"""
res=[]
with sync_playwright() as p:
  br=p.chromium.launch()
  for w,h in [(1280,800),(1024,768)]:
    pg=br.new_page(viewport={'width':w,'height':h}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(B); pg.evaluate('localStorage.clear()'); pg.reload()
    pg.screenshot(path=f'{SH}teacher_prompt_{w}.png',full_page=True); res.append((w,'prompt',pg.evaluate(OVL)))
    pg.click('text=② 匯入資料'); pg.click('button:has-text("載入範例")')
    pg.click('text=③ 班級學習落點'); assert pg.locator('.bars .row').count()>=13; assert '平均分數' in pg.inner_text('main')
    pg.screenshot(path=f'{SH}dashboard_{w}.png',full_page=True); res.append((w,'dash',pg.evaluate(OVL)))
    pg.click('text=② 匯入資料')
    pg.fill('#paste','```csv\n題號,題目,正確答案,詳解,學習內容,題型,選項,答對率,座號1,座號2,座號3\n1,"「水」的台羅是？",B,"tsuí 第二聲",聲調,選擇,"A. tsui|B. tsuí|C. tsuì",,1,0,1\n2,歹勢是不好意思,O,對,語詞,是非,,,0,0,1\n3,食飯 tsia̍h ___,pn̄g,飯,台羅拼寫,填充,,,1,1,0\n```')
    pg.click('text=匯入貼上的資料'); assert '匯入成功：3 題、3 位' in pg.inner_text('main'), pg.inner_text('main')[:300]
    pg.screenshot(path=f'{SH}import_{w}.png',full_page=True); res.append((w,'import',pg.evaluate(OVL)))
    pg.click('text=④ 學生檢討頁'); url=pg.inner_text('#rlink')
    pg.screenshot(path=f'{SH}share_{w}.png'); res.append((w,'share',pg.evaluate(OVL)))
    with pg.expect_download() as d: pg.click('text=下載檢討頁 HTML')
    d.value.save_as(f'{SH}standalone.html'); assert not errs, errs; pg.close()
  # student flow on phone
  for name,vp,target in [('phone',{'width':390,'height':844},url),('tablet',{'width':1024,'height':768},url),('standalone',{'width':390,'height':844},'file://'+SH+'standalone.html')]:
    pg=br.new_page(viewport=vp); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(target)
    pg.fill('#seat','7'); pg.click('.qs button[data-q="1"]'); pg.click('.qs button[data-q="3"]')
    pg.screenshot(path=f'{SH}student_{name}_1pick.png',full_page=True); res.append((name,'pick',pg.evaluate(OVL)))
    pg.click('#next'); assert '正確答案' in pg.inner_text('#rv'); pg.screenshot(path=f'{SH}student_{name}_2explain.png',full_page=True); res.append((name,'exp',pg.evaluate(OVL)))
    pg.click('#next')
    # 訂正練習: q1 answer wrong, q3 right
    pg.click('.opt >> nth=0'); assert '再想想' in pg.inner_text('#fb'); pg.screenshot(path=f'{SH}student_{name}_3practice.png',full_page=True); res.append((name,'prac',pg.evaluate(OVL))); pg.click('#cont')
    pg.fill('#fill','pn̄g'); pg.click('#send'); assert '答對了' in pg.inner_text('#fb'); pg.click('#cont')
    assert '再次挑戰' in pg.inner_text('.box'); wrong=0
    for _ in range(10):
      if pg.locator('.done').count(): break
      if pg.locator('#fill').count(): pg.fill('#fill','pn̄g' if wrong else 'nope'); pg.click('#send')
      else: pg.click('.opt >> nth=1')
      wrong+=1; pg.click('#cont')
    assert pg.locator('.done').count(), pg.inner_text('#rv')
    pg.screenshot(path=f'{SH}student_{name}_4done.png',full_page=True); res.append((name,'done',pg.evaluate(OVL)))
    assert not errs, errs; pg.close()
for r in res: print(r)
print('ALL OK')
