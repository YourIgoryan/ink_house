import { FormEvent, useEffect, useState } from 'react'
import { get, post, patch, put, mediaUrl } from './api/client'
type Master={id:number;name:string;bio:string;styles:string;photo_url?:string;portfolio_urls?:string[];is_active:boolean}
type Service={id:number;title:string;description:string;duration_minutes:number;price_from:number;is_active:boolean}
type Slot={starts_at:string;label:string}
type Booking={id:number;master_id:number;service_id:number;client_name:string;client_contact:string;reference_url:string;starts_at:string;ends_at:string;status:string;notes:string;master_name:string;service_title:string}
type Hour={id?:number;master_id?:number;weekday:number;opens_at:string;closes_at:string;is_closed:boolean}
type Me={telegram_user_id:number;is_admin:boolean}
const days=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const fmt=(s:string)=>new Date(s).toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'})
const statuses:Record<string,string>={pending:'Ожидает подтверждения',confirmed:'Подтверждена',cancelled:'Отменена'}
const err=(e:unknown)=>e instanceof Error?e.message:'Неизвестная ошибка'
const demoPortfolio = (styles:string, index:number, masterIndex=0) => {
 const s=styles.toLowerCase()
 // Separate photo pools by artist so the first and third master never reuse the same demo shots.
 const geometric = masterIndex===0 ? [1993189, 4750247, 29547856] : masterIndex===2 ? [9079557, 16495447, 8349189] : [29547856, 1993189, 9079557]
 const fineLine = masterIndex===0 ? [34155039, 9356536, 2531536] : masterIndex===2 ? [4750247, 29547856, 8349189] : [2531536, 34155039, 9079557]
 const blackwork = masterIndex===0 ? [8349189, 16495447, 9079557] : masterIndex===2 ? [1993189, 29547856, 4750247] : [16495447, 8349189, 2531536]
 const fallback = masterIndex===0 ? [9356536, 8349189, 4750247] : masterIndex===2 ? [29547856, 34155039, 16495447] : [2531536, 9079557, 1993189]
 const ids = s.includes('миним') || s.includes('fine') || s.includes('тонк') ? fineLine
   : s.includes('реал') || s.includes('blackwork') || s.includes('блэк') ? blackwork
   : s.includes('граф') || s.includes('геометр') ? geometric
   : fallback
 const id=ids[index%ids.length]
 return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1000`
}
const demoPortfolioTitle = (styles:string,index:number) => { const s=styles.toLowerCase(); if(s.includes('граф')||s.includes('геометр')) return ['Геометрическая композиция','Графичный символ','Линейная абстракция'][index%3]; if(s.includes('реал')) return ['Портретный этюд','Контрастный эскиз','Детализированный образ'][index%3]; if(s.includes('миним')) return ['Минималистичный знак','Тонкая линия','Лаконичный символ'][index%3]; return ['Авторская композиция','Орнаментальная работа','Эскиз в фирменном стиле'][index%3]; }
function polishedDescription(value?: string): string {
 if (!value) return ''
 if (value === 'Мастер с опытом в графике и геометрии.') {
  return 'Опытный мастер, специализирующийся на графике, чётких линиях и геометрических композициях.'
 }
 if (value === 'Небольшой рисунок с простым контуром.') {
  return 'Миниатюрная татуировка с лаконичным контуром — аккуратный вариант для небольшого рисунка.'
 }
 return value
}
export default function App(){
 const [masters,setMasters]=useState<Master[]>([]),[services,setServices]=useState<Service[]>([]),[me,setMe]=useState<Me|null>(null)
 const [page,setPage]=useState<'book'|'mine'|'admin'>('book'),[masterId,setMasterId]=useState(''),[serviceId,setServiceId]=useState(''),[day,setDay]=useState(today()),[slots,setSlots]=useState<Slot[]>([]),[slot,setSlot]=useState('')
 const [slotsLoading, setSlotsLoading] = useState(false)
 const [name,setName]=useState(''),[nameError,setNameError]=useState(''),[contact,setContact]=useState(''),[contactError,setContactError]=useState(''),[slotError,setSlotError]=useState(''),[notes,setNotes]=useState(''),[refUrl,setRefUrl]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 const [privacyConsent,setPrivacyConsent]=useState(false),[consentError,setConsentError]=useState('')
 const [mine,setMine]=useState<Booking[]>([]),[bookings,setBookings]=useState<Booking[]>([]),[allMasters,setAllMasters]=useState<Master[]>([]),[allServices,setAllServices]=useState<Service[]>([])
 const [masterForm,setMasterForm]=useState({name:'',styles:'',bio:''}),[serviceForm,setServiceForm]=useState({title:'',description:'',duration_minutes:90,price_from:4000})
 const [scheduleMaster,setScheduleMaster]=useState(''),[hours,setHours]=useState<Hour[]>([])
 const [portfolioMaster,setPortfolioMaster]=useState<Master|null>(null)
 const [rescheduleTarget,setRescheduleTarget]=useState<Booking|null>(null)
 const [rescheduleDay,setRescheduleDay]=useState(today())
 const [rescheduleSlots,setRescheduleSlots]=useState<Slot[]>([])
 const [rescheduleSlot,setRescheduleSlot]=useState('')
 const [rescheduleLoading,setRescheduleLoading]=useState(false)
 const [rescheduleSaving,setRescheduleSaving]=useState(false)
 async function init() {
  try {
    const [m, s] = await Promise.all([
      get<Master[]>('/api/masters'),
      get<Service[]>('/api/services')
    ])

    setMasters(m)
    setServices(s)

    if (m.length > 0) {
      setMasterId(current => current || String(m[0].id))
    }

    if (s.length > 0) {
      setServiceId(current => current || String(s[0].id))
    }
  } catch (e) {
    setNotice(`Не удалось загрузить мастеров и услуги: ${err(e)}`)
  }

  try {
    setMe(await get<Me>('/api/me'))
  } catch {
    setMe(null)
  }
}
 async function loadSlots() {
  if (!masterId || !serviceId || !day) {
    setSlots([])
    setSlot('')
    return
  }

  setSlotsLoading(true)

  try {
    const r = await get<{ slots: Slot[] }>(
      `/api/appointments/availability?master_id=${masterId}&service_id=${serviceId}&day=${day}`
    )

    setSlots(r.slots)
    setSlot(current =>
      r.slots.some(s => s.starts_at === current) ? current : ''
    )
  } catch (e) {
    setSlots([])
    setSlot('')
    setNotice(`Не удалось загрузить время: ${err(e)}`)
  } finally {
    setSlotsLoading(false)
  }
}

    useEffect(() => {
        void init()
    }, [])

    // Подгружаем свободные интервалы при изменении мастера, услуги или даты.
    useEffect(() => {
        void loadSlots()
    }, [masterId, serviceId, day])


 async function loadMine(){try{setMine(await get<Booking[]>('/api/appointments/mine'))}catch(e){setNotice(err(e))}}
 async function loadAdmin(){try{const [b,m,s]=await Promise.all([get<Booking[]>('/api/admin/appointments'),get<Master[]>('/api/admin/masters'),get<Service[]>('/api/admin/services')]);setBookings(b);setAllMasters(m);setAllServices(s);if(!scheduleMaster&&m[0])setScheduleMaster(String(m[0].id))}catch(e){setNotice(err(e))}}
 useEffect(()=>{if(page==='mine')void loadMine();if(page==='admin'&&me?.is_admin)void loadAdmin()},[page,me?.is_admin])
 async function loadHours(id:string){if(!id)return;try{const r=await get<Hour[]>(`/api/admin/masters/${id}/working-hours`);const map=new Map(r.map(h=>[h.weekday,h]));setHours(days.map((_,weekday)=>map.get(weekday)||{weekday,opens_at:'10:00',closes_at:'20:00',is_closed:weekday===6}))}catch(e){setNotice(err(e))}}
 useEffect(()=>{if(page==='admin'&&scheduleMaster)void loadHours(scheduleMaster)},[scheduleMaster,page])
 async function upload(file?:File){if(!file)return;const f=new FormData();f.append('file',file);setBusy(true);try{const r=await post<{url:string}>('/api/uploads/reference',f);setRefUrl(r.url);setNotice('Референс загружен.')}catch(e){setNotice(err(e))}finally{setBusy(false)}}
 async function submitBooking(e:FormEvent){
  e.preventDefault()
  let invalid=false
  const normalizedName=name.trim()
  const normalizedContact=contact.trim()
  if(normalizedName.length<2){setNameError('Укажите, пожалуйста, как к Вам обращаться.');invalid=true}else setNameError('')
  if(!normalizedContact){setContactError('Укажите Telegram с @ или номер телефона для связи.');invalid=true}
  else if(/^[A-Za-z0-9_]{5,32}$/.test(normalizedContact)){setContactError('Укажите Telegram с символом @ в начале, например @username.');invalid=true}
  else if(!(/^@[A-Za-z0-9_]{5,32}$/.test(normalizedContact)||/^\+7[\d ()-]{10,18}$/.test(normalizedContact)||/^\+?[1-9][\d ()-]{7,18}$/.test(normalizedContact))){setContactError('Некорректный контакт. Укажите Telegram в формате @username или телефон, например +7 999 123-45-67.');invalid=true}
  else setContactError('')
  if(!slot){setSlotError('Выберите свободное время для записи.');invalid=true}else setSlotError('')
  if(!privacyConsent){setConsentError('Для отправки заявки необходимо подтвердить согласие на обработку персональных данных.');invalid=true}else setConsentError('')
  if(invalid)return
  setBusy(true)
  try{const b=await post<Booking>('/api/appointments',{master_id:Number(masterId),service_id:Number(serviceId),client_name:normalizedName,client_contact:normalizedContact,reference_url:refUrl,starts_at:slot,notes});setNotice(`Заявка №${b.id} отправлена и ожидает подтверждения.`);setName('');setNameError('');setContact('');setContactError('');setNotes('');setRefUrl('');setSlot('');setSlotError('');setPrivacyConsent(false);setConsentError('');await loadSlots()}
  catch(e){setNotice(err(e));await loadSlots()}
  finally{setBusy(false)}
 }
 async function cancel(id:number){if(!confirm(`Отменить запись №${id}?`))return;try{await post(`/api/appointments/${id}/cancel`);setNotice('Запись отменена.');await loadMine();await loadSlots()}catch(e){setNotice(err(e))}}
 async function loadRescheduleSlots(target:Booking, selectedDay:string){
  if(!selectedDay){setRescheduleSlots([]);setRescheduleSlot('');return}
  setRescheduleLoading(true)
  setRescheduleSlots([])
  setRescheduleSlot('')
  try{
   const r=await get<{slots:Slot[]}>(`/api/appointments/availability?master_id=${target.master_id}&service_id=${target.service_id}&day=${selectedDay}`)
   setRescheduleSlots(r.slots)
  }catch(e){setNotice(`Не удалось загрузить свободное время: ${err(e)}`)}
  finally{setRescheduleLoading(false)}
 }
 useEffect(()=>{if(rescheduleTarget)void loadRescheduleSlots(rescheduleTarget,rescheduleDay)},[rescheduleTarget?.id,rescheduleDay])
 function openReschedule(b:Booking){setRescheduleTarget(b);setRescheduleDay(today());setRescheduleSlot('');setRescheduleSlots([])}
 async function confirmReschedule(){
  if(!rescheduleTarget||!rescheduleSlot){setNotice('Сначала выбери свободное время.');return}
  setRescheduleSaving(true)
  try{
   await post(`/api/appointments/${rescheduleTarget.id}/reschedule?starts_at=${encodeURIComponent(rescheduleSlot)}`)
   setNotice(`Заявка №${rescheduleTarget.id} перенесена и ожидает подтверждения.`)
   setRescheduleTarget(null);setRescheduleSlot('');setRescheduleSlots([])
   await loadMine()
  }catch(e){setNotice(`Не удалось перенести запись: ${err(e)}`);if(rescheduleTarget)await loadRescheduleSlots(rescheduleTarget,rescheduleDay)}
  finally{setRescheduleSaving(false)}
 }
 async function status(id:number,s:string){try{await patch(`/api/admin/appointments/${id}/status?status=${s}`);setNotice('Статус обновлён.');await loadAdmin()}catch(e){setNotice(err(e))}}
 async function addMaster(e:FormEvent){e.preventDefault();try{await post('/api/admin/masters',masterForm);setMasterForm({name:'',styles:'',bio:''});setNotice('Мастер добавлен.');await loadAdmin()}catch(e){setNotice(err(e))}}
 async function addService(e:FormEvent){e.preventDefault();try{await post('/api/admin/services',serviceForm);setServiceForm({title:'',description:'',duration_minutes:90,price_from:4000});setNotice('Услуга добавлена.');await loadAdmin()}catch(e){setNotice(err(e))}}
 async function toggleMaster(m:Master){try{await patch(`/api/admin/masters/${m.id}/active?is_active=${!m.is_active}`);await loadAdmin()}catch(e){setNotice(err(e))}}
 async function toggleService(s:Service){try{await patch(`/api/admin/services/${s.id}/active?is_active=${!s.is_active}`);await loadAdmin()}catch(e){setNotice(err(e))}}
 async function saveHours(e:FormEvent){e.preventDefault();try{await put(`/api/admin/masters/${scheduleMaster}/working-hours`,hours.map(({weekday,opens_at,closes_at,is_closed})=>({weekday,opens_at,closes_at,is_closed})));setNotice('Расписание сохранено.')}catch(e){setNotice(err(e))}}
 function setHour(w:number,k:keyof Hour,v:string|boolean){setHours(old=>old.map(h=>h.weekday===w?{...h,[k]:v}:h))}

 if (window.location.pathname.replace(/\/+$/, '') === '/privacy-policy') return <main className="shell legal-page">
  <header className="top"><a className="brand legal-brand" href="/">INK<span>HOUSE</span><sup>®</sup></a><a className="legal-back" href="/">← Вернуться на сайт</a></header>
  <article className="panel legal-document">
   <div className="legal-hero"><span className="eyebrow">INK HOUSE / ПРАВОВАЯ ИНФОРМАЦИЯ</span><h1>ПОЛИТИКА<br/><em>ОБРАБОТКИ ПЕРСОНАЛЬНЫХ ДАННЫХ</em></h1><p>Как мы используем информацию, которую вы оставляете при обращении в студию и оформлении записи.</p><div className="legal-meta"><span>Редакция: 12 октября 2026 года</span><span>Применяется к сайту и форме записи INK HOUSE</span></div></div>
   <div className="legal-operator-warning"><strong>Перед публикацией обязательно заполните данные оператора.</strong><p>Вместо полей в квадратных скобках укажите реальные сведения владельца студии. Без этого документ не готов к публикации.</p></div>
   <nav className="legal-toc" aria-label="Содержание политики"><strong>В документе</strong><a href="#lp-1">01. Общие положения</a><a href="#lp-2">02. Оператор и контакты</a><a href="#lp-3">03. Какие данные обрабатываются</a><a href="#lp-4">04. Цели и основания</a><a href="#lp-5">05. Действия с данными</a><a href="#lp-6">06. Передача третьим лицам</a><a href="#lp-7">07. Сроки хранения</a><a href="#lp-8">08. Защита информации</a><a href="#lp-9">09. Права пользователя</a><a href="#lp-10">10. Заключительные положения</a></nav>
   <section id="lp-1"><span className="legal-section-num">01 / ОБЩИЕ ПОЛОЖЕНИЯ</span><h2>О чём этот документ</h2><p>Настоящая Политика обработки персональных данных (далее — «Политика») описывает порядок и условия обработки персональных данных пользователей сайта и сервиса записи INK HOUSE (далее — «Сервис»), а также меры, принимаемые для их защиты.</p><p>Политика подготовлена с учётом Федерального закона РФ от 27.07.2006 № 152-ФЗ «О персональных данных» и иных применимых требований законодательства Российской Федерации. Она распространяется на данные, которые пользователь сообщает через форму записи, при обращении к студии и при использовании функций Сервиса.</p><p>Политика не заменяет отдельные согласия, если они требуются для конкретной цели обработки, например для рекламных рассылок или публикации фотографии клиента.</p></section>
   <section id="lp-2"><span className="legal-section-num">02 / ОПЕРАТОР</span><h2>Кто отвечает за обработку</h2><p>Оператор персональных данных:</p><div className="legal-details"><p><b>ФИО / наименование:</b> [УКАЖИТЕ ФИО ИП ИЛИ ПОЛНОЕ НАИМЕНОВАНИЕ ОРГАНИЗАЦИИ]</p><p><b>Статус и реквизиты:</b> [ИП / ООО / физическое лицо и необходимые реквизиты]</p><p><b>Адрес:</b> [УКАЖИТЕ АДРЕС ОПЕРАТОРА]</p><p><b>Контакт для обращений по персональным данным:</b> [УКАЖИТЕ РАБОЧИЙ E-MAIL ИЛИ ИНОЙ КАНАЛ]</p></div><p>Далее в тексте указанное лицо именуется «Оператор». Оператор определяет цели обработки, состав обрабатываемых данных и действия, совершаемые с ними, и отвечает за соблюдение требований законодательства в пределах своей роли.</p></section>
   <section id="lp-3"><span className="legal-section-num">03 / СОСТАВ ДАННЫХ</span><h2>Какие данные мы можем получать</h2><ul><li><b>Данные для связи:</b> имя, Telegram username и/или номер телефона, которые пользователь указывает в форме.</li><li><b>Данные записи:</b> выбранный мастер, услуга, дата и время, статус заявки и технический номер заявки.</li><li><b>Сведения о пожеланиях:</b> текст комментария, описание идеи, размера и места татуировки, которые пользователь добровольно сообщает.</li><li><b>Референс:</b> изображение, которое пользователь по желанию прикрепляет к заявке.</li><li><b>Технические данные:</b> журналы запросов, IP-адрес, сведения о браузере и события безопасности — только если они фактически собираются используемым сервером, хостингом или подключёнными инструментами.</li></ul><p>Пожалуйста, не указывайте в комментариях избыточные сведения, включая данные о здоровье, документы, платёжные реквизиты и другую чувствительную информацию, если она не требуется для согласования записи.</p><p>Оператор не ставит целью собирать специальные категории персональных данных. Если пользователь самостоятельно укажет такие сведения, они обрабатываются только при наличии предусмотренного законом основания и в необходимом объёме.</p></section>
   <section id="lp-4"><span className="legal-section-num">04 / ЦЕЛИ И ОСНОВАНИЯ</span><h2>Для чего нужны данные</h2><ul><li>принять, зарегистрировать и обработать заявку на запись;</li><li>связаться с пользователем, уточнить детали, подтвердить, перенести или отменить запись;</li><li>подобрать мастера и услугу, согласовать эскиз и организационные детали;</li><li>передать заявку ответственному администратору и организовать оказание услуги;</li><li>обеспечивать работоспособность Сервиса, предотвращать злоупотребления и устранять технические ошибки;</li><li>рассматривать обращения пользователя и исполнять обязательные требования законодательства.</li></ul><p>Правовое основание для конкретной операции определяется Оператором с учётом её цели и обстоятельств: это может быть согласие пользователя, необходимость совершить действия по его запросу до заключения договора, исполнение договора или обязанность, прямо установленная законом. Если для обработки требуется согласие, оно запрашивается отдельно и не подменяется фактом ознакомления с этой Политикой.</p><p>Данные заявки не используются для рекламных рассылок без отдельного надлежащего основания. Согласие на обработку заявки само по себе не означает согласия на публикацию фотографии клиента, его татуировки или переписки.</p></section>
   <section id="lp-5"><span className="legal-section-num">05 / ОПЕРАЦИИ</span><h2>Как обрабатываются данные</h2><p>В зависимости от функции Сервиса Оператор может осуществлять сбор, запись, систематизацию, накопление, хранение, уточнение, извлечение, использование, передачу в предусмотренных целях, блокирование и удаление персональных данных.</p><p>Обработка может осуществляться с использованием средств автоматизации и без них. Доступ к заявкам предоставляется только лицам, которым сведения необходимы для связи с клиентом и организации записи. Оператор не должен собирать данные, не относящиеся к заявленной цели, и должен ограничивать доступ к ним служебной необходимостью.</p></section>
   <section id="lp-6"><span className="legal-section-num">06 / ПЕРЕДАЧА ДАННЫХ</span><h2>Кто ещё может получать информацию</h2><p>Для работы Сервиса данные могут обрабатываться поставщиками технической инфраструктуры — например, хостинг-провайдером и поставщиком базы данных, если они используются в фактической конфигурации. Если в проекте включены уведомления администратору через Telegram, данные заявки могут передаваться Telegram для доставки сообщения. Доступ к загруженному референсу может предоставляться администратору, обрабатывающему заявку.</p><p><b>До публикации Оператор должен перечислить фактических получателей и проверить, где расположены сервер и база данных, как настроены резервные копии, куда передаются уведомления и применяются ли трансграничные передачи.</b> Нельзя считать, что передача данных отсутствует, только потому, что сайт не показывает пользователю отдельного окна передачи.</p><p>При сборе персональных данных граждан Российской Федерации через интернет Оператор обеспечивает соблюдение применимых требований законодательства о локализации баз данных. Передача данных за пределы Российской Федерации допускается только после проверки применимых требований и выполнения необходимых процедур.</p></section>
   <section id="lp-7"><span className="legal-section-num">07 / СРОКИ ХРАНЕНИЯ</span><h2>Как долго хранятся данные</h2><p>Данные хранятся не дольше, чем этого требуют цели обработки, договорные отношения и применимые требования законодательства. По достижении цели или при наступлении другого законного основания данные удаляются или уничтожаются, если их дальнейшее хранение не требуется по закону.</p><p>Оператор обязан определить конкретные сроки для заявок, отменённых записей, переписки, загруженных референсов и резервных копий с учётом фактической архитектуры Сервиса. До публикации заполните внутренний регламент хранения: <b>[УКАЖИТЕ УТВЕРЖДЁННЫЕ СРОКИ ИЛИ КРИТЕРИИ УДАЛЕНИЯ]</b>. Если данные нужны для бухгалтерского учёта, разрешения спора или исполнения законной обязанности, они могут храниться в течение соответствующего установленного срока.</p></section>
   <section id="lp-8"><span className="legal-section-num">08 / МЕРЫ ЗАЩИТЫ</span><h2>Как защищается информация</h2><p>Оператор принимает необходимые и достаточные правовые, организационные и технические меры с учётом характера данных и рисков обработки. К таким мерам, в зависимости от фактической реализации, относятся ограничение доступа к административным функциям, использование паролей и секретов вне публичного кода, обновление программного обеспечения, резервное копирование, контроль доступа к базе данных и реагирование на инциденты.</p><p>Перечисление мер не означает, что каждая из них уже настроена в конкретном развёртывании. Оператор обязан проверить конфигурацию сервера, права доступа, хранение секретов, резервные копии и порядок действий при инциденте до начала полноценной эксплуатации.</p></section>
   <section id="lp-9"><span className="legal-section-num">09 / ПРАВА ПОЛЬЗОВАТЕЛЯ</span><h2>Как запросить доступ, исправление или удаление</h2><p>Пользователь может обратиться к Оператору, чтобы запросить сведения об обработке своих персональных данных, потребовать уточнения неточных или неполных сведений, узнать основания и порядок обработки, отозвать ранее данное согласие либо потребовать прекращения обработки или уничтожения данных в случаях, предусмотренных законом.</p><p>Обращение направляется по адресу: <b>[УКАЖИТЕ КОНТАКТ ДЛЯ ОБРАЩЕНИЙ]</b>. Чтобы найти нужную запись и защитить данные от раскрытия постороннему лицу, Оператор может запросить информацию, разумно необходимую для подтверждения личности заявителя. Не отправляйте вместе с обращением копии документов, если Оператор не объяснил, почему они действительно необходимы.</p><p>Отзыв согласия не делает незаконной обработку, которая была осуществлена до его получения Оператором. В случаях, когда закон допускает дальнейшую обработку на ином основании, Оператор может продолжить её в пределах такого основания. Обращения рассматриваются в сроки, установленные применимым законодательством.</p></section>
   <section id="lp-10"><span className="legal-section-num">10 / ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ</span><h2>Обновление документа</h2><p>Оператор может обновлять Политику при изменении функциональности Сервиса, состава данных, поставщиков услуг или требований законодательства. Новая редакция размещается на этой странице с указанием даты обновления. Если изменение требует нового согласия, оно запрашивается отдельно в предусмотренном законом порядке.</p><p>Вопросы, связанные с обработкой персональных данных, направляйте по контактам, указанным в разделе 2. Политика доступна на странице <a href="/privacy-policy">/privacy-policy</a>.</p></section>
   <aside className="legal-note"><strong>Важно перед запуском.</strong> Это содержательный проект документа, но его нельзя публиковать без заполнения реквизитов Оператора, контакта, фактических получателей данных и сроков хранения. Также нужно проверить реальную работу backend, базы данных, хостинга, загрузки референсов и уведомлений Telegram. Обязанность публиковать политику и сведения о мерах защиты при сборе данных через сайт установлена статьёй 18.1 152-ФЗ; согласие должно быть конкретным и оформляться отдельно от иных документов и информации в соответствии со статьёй 9. <a href="https://www.consultant.ru/document/cons_doc_LAW_61801/eeeebe22bf738fd65bb66b95cc278911ae2525ee/" target="_blank" rel="noreferrer">Статья 18.1</a> · <a href="https://www.consultant.ru/document/cons_doc_LAW_61801/6c94959bc017ac80140621762d2ac59f6006b08c/" target="_blank" rel="noreferrer">Статья 9</a>.</aside>
  </article>
  <footer className="site-footer"><div className="footer-brand">INK HOUSE <span>·</span> MADE TO LAST</div><div className="footer-copy">© {new Date().getFullYear()} INK HOUSE</div></footer>
 </main>

 return <main className="shell"><header className="top"><div className="brand">INK<span>HOUSE</span><sup>®</sup></div><div className="top-right"><div className="social-links" aria-label="Связаться с нами"><a href="https://t.me/" target="_blank" rel="noreferrer" aria-label="Telegram" title="Telegram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.4 4.6 18.2 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L5.6 13.5.7 12c-1.1-.3-1.1-1 .2-1.5L20 3.1c.9-.3 1.7.2 1.4 1.5Z"/></svg></a><a href="https://www.whatsapp.com/" target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 2 17.7L.5 23.5l6-1.6A11.8 11.8 0 0 0 20.5 3.5ZM12 21a9.7 9.7 0 0 1-4.9-1.3l-.4-.2-3.6 1 1-3.5-.2-.4A9.7 9.7 0 1 1 12 21Zm5.3-7.3c-.3-.2-1.7-.9-2-.9s-.5-.2-.7.2-.8.9-1 .9-.4 0-.7-.2a8.2 8.2 0 0 1-2.4-2.1c-.2-.3.2-.5.5-.9.1-.2.2-.3.3-.5s0-.4 0-.5l-.9-2.1c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.4 1 2.8 1.2 3 2 3.1 5 4.2c1.8.8 2.5.8 3.4.7.5-.1 1.7-.7 2-1.4s.3-1.3.2-1.4-.2-.2-.5-.4Z"/></svg></a></div></div></header><section className="hero"><div className="hero-copy"><div className="hero-tag">PERSONAL INK EXPERIENCE <span>✳</span></div><h1>ТВОЯ ИСТОРИЯ<br/><em>НА КОЖЕ.</em></h1><p>Индивидуальные эскизы, опытные мастера и строгая стерильность. Создаём татуировки, которые остаются с тобой навсегда.</p><button type="button" className="hero-cta" onClick={() => document.getElementById('booking-form')?.scrollIntoView({behavior:'smooth',block:'start'})}>ЗАПИСАТЬСЯ НА СЕАНС <span>↗</span></button></div><div className="hero-art" aria-label="Декоративная графика INK HOUSE"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-spark spark-one">✳</div><div className="art-spark spark-two">✦</div><div className="art-vertical">INK IS A LANGUAGE</div><div className="art-center"><span>IH</span><i>EST. 2024</i></div><div className="art-stamp">MADE<br/>TO LAST</div></div></section>
 <nav className="tabs"><button className={page==='book'?'active':''} onClick={()=>setPage('book')}>Запись</button><button className={page==='mine'?'active':''} onClick={()=>setPage('mine')}>Мои записи</button>{me?.is_admin&&<button className={page==='admin'?'active':''} onClick={()=>setPage('admin')}>Админ</button>}</nav>
 {notice&&<div className="notice" role="status"><span>{notice}</span><button type="button" className="close" aria-label="Закрыть уведомление" onClick={()=>setNotice('')}>×</button></div>}
 {page==='book'&&<>
 <section className="services-section" id="services"><div className="section-intro"><div><span className="eyebrow">01 / УСЛУГИ</span><h2>НАШИ <em>УСЛУГИ</em></h2></div><p>От небольшой татуировки до масштабного проекта. Делаем fine line с тонкими линиями и cover-up, чтобы аккуратно обновить или перекрыть старую татуировку.</p></div><div className="service-grid">{services.map((service,index)=><button type="button" key={service.id} className={`service-tile ${service.title.toLowerCase().includes('консультац')?'consultation-tile':''}`} onClick={()=>{setServiceId(String(service.id));document.getElementById('booking-form')?.scrollIntoView({behavior:'smooth',block:'start'})}}><span className="service-icon">{service.title.toLowerCase().includes('консультац')?'✧':['✥','✺','◇','✳','✣'][index%5]}</span><strong>{service.title}</strong><p className={service.description === "Небольшой рисунок с простым контуром." ? "mobile-copy" : undefined}>{polishedDescription(service.description) || 'Индивидуальный подход и внимание к деталям.'}</p><b>{service.price_from===0?'Бесплатно':`от ${service.price_from.toLocaleString('ru-RU')} ₽`}</b></button>)}{!services.some(s=>s.title.toLowerCase().includes('консультац'))&&<button type="button" className="service-tile consultation-tile" onClick={()=>{setNotice('Чтобы консультация появилась в записи, добавь услугу «Консультация» в админ-панели: длительность 30 минут, цена 0 ₽.');document.getElementById('booking-form')?.scrollIntoView({behavior:'smooth',block:'start'})}}><span className="service-icon">✧</span><strong>Консультация</strong><p>Обсудим идею, подберём стиль, размер и место для татуировки.</p><b>Бесплатно</b></button>}</div></section>
 <section className="portfolio-section" id="artists"><div className="section-intro"><div><span className="eyebrow">02 / НАШИ МАСТЕРА</span><h2>НАШИ <em>МАСТЕРА</em></h2></div><p>Каждый мастер — свой стиль, опыт и индивидуальный подход к вашей идее.</p></div>
 {!masters.length ? <div className="empty-state"><span>✳</span><strong>Загружаем команду</strong><p>Скоро здесь появятся мастера студии.</p></div> : <div className="master-grid">{masters.map((m,index)=><article className={`master-tile master-tile-${index%3}`} key={m.id}><div className="master-photo">{m.photo_url ? <img src={mediaUrl(m.photo_url)} alt={`Портрет мастера ${m.name}`} loading="lazy"/> : <div className="master-photo-fallback"><span>{m.name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}</span><small>МАСТЕР INK HOUSE</small></div>}<span className="master-number">МАСТЕР / {String(index+1).padStart(2,'0')}</span><span className="photo-cross">✳</span></div><div className="master-details"><div className="style-pill">{m.styles || 'Авторский стиль'}</div><h3>{m.name}</h3><p className={m.bio === "Мастер с опытом в графике и геометрии." ? "mobile-copy" : undefined}>{polishedDescription(m.bio) || 'Индивидуальный подход к каждой идее и внимание к деталям.'}</p><div className="master-actions"><button type="button" className="secondary portfolio-button" onClick={()=>setPortfolioMaster(m)}>Портфолио <span>↗</span></button><button type="button" className="choose-button" onClick={()=>{setMasterId(String(m.id));document.getElementById('booking-form')?.scrollIntoView({behavior:'smooth',block:'start'})}}>Выбрать <span>↘</span></button></div></div></article>)}</div>}</section>
 <form id="booking-form" className="panel booking" onSubmit={submitBooking} noValidate><div className="section-head"><span>03 / ЗАПИСЬ НА СЕАНС</span><h2>ЗАПИШИСЬ СЕЙЧАС НА СЕАНС</h2></div>
 <div className="booking-selection">
  <label>МАСТЕР<select value={masterId} onChange={e=>setMasterId(e.target.value)} required>{masters.map(m=><option key={m.id} value={m.id}>{m.name} — {m.styles}</option>)}</select></label><p className="hint">{polishedDescription(masters.find(m=>String(m.id)===masterId)?.bio)}</p>
  <label>УСЛУГА<select value={serviceId} onChange={e=>setServiceId(e.target.value)} required>{services.map(s=><option key={s.id} value={s.id}>{s.title} · от {s.price_from.toLocaleString('ru-RU')} ₽ · {s.duration_minutes} мин</option>)}</select></label><p className="hint">{services.find(s=>String(s.id)===serviceId)?.description}</p>
  <label className="booking-date">ДАТА<input type="date" min={today()} value={day} onChange={e=>{setDay(e.target.value);setSlot('')}} required /></label>
 </div>
 <aside className="booking-aside">
  <span className="booking-aside-kicker">ТВОЯ ЗАПИСЬ / INK HOUSE</span>
  <h3>Соберём идею<br/><em>вместе.</em></h3>
  <p>Выбери мастера, услугу и удобный день — мы подберём свободное время для сеанса.</p>
  <div className="booking-summary-row"><span>МАСТЕР</span><strong>{masters.find(m=>String(m.id)===masterId)?.name || 'Выбери мастера'}</strong></div>
  <div className="booking-summary-row"><span>УСЛУГА</span><strong>{services.find(s=>String(s.id)===serviceId)?.title || 'Выбери услугу'}</strong></div>
  <div className="booking-summary-row"><span>ДАТА</span><strong>{day ? new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}) : 'Выбери дату'}</strong></div>
  <div className="booking-aside-mark">IH<span>✳</span></div>
 </aside>

<div className="time-picker">
  <div className="time-picker-heading">
    <label>СВОБОДНОЕ ВРЕМЯ</label>
    <button
      type="button"
      className="text-button"
      onClick={() => void loadSlots()}
      disabled={slotsLoading}
    >
      Обновить
    </button>
  </div>

  {slotsLoading ? (
    <p className="hint">Загружаем доступное время…</p>
  ) : slots.length > 0 ? (
    <div className="time-grid">
      {slots.map(s => (
        <button
          key={s.starts_at}
          type="button"
          className={`time-option ${slot === s.starts_at ? 'selected' : ''}`}
          aria-pressed={slot === s.starts_at}
          onClick={() => {setSlot(s.starts_at);setSlotError('')}}
        >
          {s.label}
        </button>
      ))}
    </div>
  ) : (
    <p className="hint">
      На эту дату свободного времени нет. Попробуй другой день.
    </p>
  )}

  {slotError&&<p className="field-error slot-error" role="alert">{slotError}</p>}
</div>

 <label className={`validation-field ${nameError ? 'field-invalid' : ''}`}>ВАШЕ ИМЯ<input value={name} onChange={e=>{setName(e.target.value);if(nameError)setNameError('')}} maxLength={120} placeholder="Как к Вам обращаться?" aria-invalid={!!nameError} aria-describedby={nameError ? 'name-error' : undefined}/>{nameError&&<span className="field-error" id="name-error" role="alert">{nameError}</span>}</label><label className={`contact-field ${contactError ? 'field-invalid' : ''}`}>TELEGRAM ИЛИ ТЕЛЕФОН<input value={contact} onChange={e=>{setContact(e.target.value);if(contactError)setContactError('')}} maxLength={120} placeholder="@username или +7 999 123-45-67" aria-invalid={!!contactError} aria-describedby={contactError ? 'contact-error' : undefined}/>{contactError&&<span className="field-error" id="contact-error" role="alert">{contactError}</span>}</label>
 <label>РЕФЕРЕНС ТАТУИРОВКИ<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload(e.target.files?.[0])}/></label>{refUrl&&<p className="hint">Референс прикреплён. <button type="button" className="text-button" onClick={()=>setRefUrl('')}>Убрать</button></p>}
 <label>КОММЕНТАРИЙ ДЛЯ ВАШЕГО МАСТЕРА<textarea rows={3} maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Размер, место на теле, идея татуировки…"/></label>
 <div className={`privacy-consent ${consentError ? 'has-error' : ''}`}>
  <label className="privacy-consent-label"><input type="checkbox" checked={privacyConsent} onChange={e=>{setPrivacyConsent(e.target.checked);if(consentError)setConsentError('')}} aria-invalid={!!consentError} aria-describedby={consentError ? 'privacy-consent-error' : undefined}/><span>Я отдельно и добровольно даю согласие на обработку моих персональных данных для рассмотрения заявки и организации записи.</span></label>
  <p className="privacy-consent-policy">Перед отправкой заявки ознакомьтесь с <a href="/privacy-policy" target="_blank" rel="noreferrer">Политикой обработки персональных данных</a>.</p>
  {consentError&&<span className="field-error" id="privacy-consent-error" role="alert">{consentError}</span>}
 </div>
 <button className="primary" disabled={busy||!masters.length||!services.length}>{busy?'ОТПРАВЛЯЕМ…':'ОТПРАВИТЬ ЗАЯВКУ ↗'}</button><p className="fine">Заявка подтверждается администратором. Время указано по часовому поясу салона.</p></form></>}
 {page==='mine'&&<section className="panel"><div className="section-head"><span>02 / ЛИЧНЫЙ КАБИНЕТ</span><h2>Мои записи</h2></div>{!mine.length&&<p className="hint">Записей пока нет.</p>}{mine.map(b=><article className="booking-card" key={b.id}><div className="card-row"><strong>Заявка №{b.id}</strong><span className={`status ${b.status}`}>{statuses[b.status]}</span></div><p>{b.master_name} · {b.service_title}</p><p>{fmt(b.starts_at)}</p>{b.reference_url&&<a href={mediaUrl(b.reference_url)} target="_blank" rel="noreferrer">Открыть референс</a>}{b.status!=='cancelled'&&new Date(b.starts_at)>new Date()&&<><div className="actions"><button className="secondary" onClick={()=>rescheduleTarget?.id===b.id?setRescheduleTarget(null):openReschedule(b)}>{rescheduleTarget?.id===b.id?'Закрыть перенос':'Перенести'}</button><button className="secondary" onClick={()=>void cancel(b.id)}>Отменить запись</button></div>{rescheduleTarget?.id===b.id&&<div className="reschedule-panel"><div className="reschedule-heading"><strong>Выбери новую дату и время</strong><span>{b.master_name} · {b.service_title}</span></div><label className="reschedule-date">Дата записи<input type="date" min={today()} value={rescheduleDay} onChange={e=>setRescheduleDay(e.target.value)}/></label>{rescheduleLoading?<p className="hint">Ищем свободное время…</p>:rescheduleSlots.length===0?<p className="hint">На эту дату свободных окон нет. Выбери другой день.</p>:<div className="time-grid reschedule-time-grid">{rescheduleSlots.map(s=><button type="button" key={s.starts_at} className={`time-option ${rescheduleSlot===s.starts_at?'selected':''}`} onClick={()=>setRescheduleSlot(s.starts_at)}>{s.label}</button>)}</div>}<div className="actions reschedule-actions"><button type="button" className="primary" disabled={!rescheduleSlot||rescheduleLoading||rescheduleSaving} onClick={()=>void confirmReschedule()}>{rescheduleSaving?'Переносим…':'Подтвердить перенос'}</button></div></div>}</>}</article>)}<button className="secondary" onClick={()=>void loadMine()}>Обновить список</button></section>}
 {page==='admin'&&me?.is_admin&&<section className="panel"><div className="section-head"><span>03 / УПРАВЛЕНИЕ САЛОНОМ</span><h2>Админ-панель</h2></div><h3>Заявки</h3>{!bookings.length&&<p className="hint">Заявок пока нет.</p>}{bookings.map(b=><article className="booking-card" key={b.id}><div className="card-row"><strong>№{b.id} · {b.client_name}</strong><span className={`status ${b.status}`}>{statuses[b.status]}</span></div><p>{b.master_name} · {b.service_title}</p><p>{fmt(b.starts_at)} · {b.client_contact||'контакт не указан'}</p>{b.notes&&<p>{b.notes}</p>}{b.reference_url&&<a href={mediaUrl(b.reference_url)} target="_blank" rel="noreferrer">Референс клиента</a>}<div className="actions">{b.status!=='confirmed'&&<button className="secondary" onClick={()=>void status(b.id,'confirmed')}>Подтвердить</button>}{b.status!=='cancelled'&&<button className="secondary" onClick={()=>void status(b.id,'cancelled')}>Отменить</button>}{b.status!=='pending'&&<button className="secondary" onClick={()=>void status(b.id,'pending')}>В ожидание</button>}</div></article>)}<button className="secondary" onClick={()=>void loadAdmin()}>Обновить заявки</button>
 <div className="admin-section"><h3>Мастера</h3>{allMasters.map(m=><div className="manage-row" key={m.id}><div><strong>{m.name}</strong><small>{m.styles} · {m.is_active?'активен':'скрыт'}</small></div><button className="tiny" onClick={()=>void toggleMaster(m)}>{m.is_active?'Скрыть':'Включить'}</button></div>)}<form className="compact-form" onSubmit={addMaster}><input placeholder="Имя мастера" value={masterForm.name} onChange={e=>setMasterForm({...masterForm,name:e.target.value})} minLength={2} required/><input placeholder="Стили" value={masterForm.styles} onChange={e=>setMasterForm({...masterForm,styles:e.target.value})}/><input placeholder="Краткое описание" value={masterForm.bio} onChange={e=>setMasterForm({...masterForm,bio:e.target.value})}/><button className="primary">Добавить мастера</button></form></div>
 <div className="admin-section"><h3>Услуги</h3>{allServices.map(s=><div className="manage-row" key={s.id}><div><strong>{s.title}</strong><small>{s.duration_minutes} мин · от {s.price_from} ₽ · {s.is_active?'активна':'скрыта'}</small></div><button className="tiny" onClick={()=>void toggleService(s)}>{s.is_active?'Скрыть':'Включить'}</button></div>)}<form className="compact-form" onSubmit={addService}><input placeholder="Название услуги" value={serviceForm.title} onChange={e=>setServiceForm({...serviceForm,title:e.target.value})} minLength={2} required/><input placeholder="Описание" value={serviceForm.description} onChange={e=>setServiceForm({...serviceForm,description:e.target.value})}/><div className="two"><label>Длительность, мин<input type="number" min={30} max={720} step={30} value={serviceForm.duration_minutes} onChange={e=>setServiceForm({...serviceForm,duration_minutes:Number(e.target.value)})}/></label><label>Цена от, ₽<input type="number" min={0} value={serviceForm.price_from} onChange={e=>setServiceForm({...serviceForm,price_from:Number(e.target.value)})}/></label></div><button className="primary">Добавить услугу</button></form></div>
 <div className="admin-section"><h3>Рабочее расписание</h3><label>МАСТЕР<select value={scheduleMaster} onChange={e=>setScheduleMaster(e.target.value)}>{allMasters.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><form onSubmit={saveHours}>{hours.map(h=><div className="hours-row" key={h.weekday}><strong>{days[h.weekday]}</strong><label className="check"><input type="checkbox" checked={h.is_closed} onChange={e=>setHour(h.weekday,'is_closed',e.target.checked)}/> Выходной</label>{!h.is_closed&&<div className="two time-inputs"><input type="time" aria-label="Открытие" value={h.opens_at} onChange={e=>setHour(h.weekday,'opens_at',e.target.value)}/><input type="time" aria-label="Закрытие" value={h.closes_at} onChange={e=>setHour(h.weekday,'closes_at',e.target.value)}/></div>}</div>)}<button className="primary">Сохранить расписание</button></form></div></section>}

{portfolioMaster&&<div className="modal-backdrop" role="presentation" onClick={()=>setPortfolioMaster(null)}><section className="portfolio-modal" role="dialog" aria-modal="true" aria-labelledby="portfolio-title" onClick={e=>e.stopPropagation()}><div className="modal-topline"><span className="eyebrow">INK HOUSE / ПРОФИЛЬ МАСТЕРА</span><button type="button" className="modal-close" aria-label="Закрыть портфолио" onClick={()=>setPortfolioMaster(null)}>×</button></div><div className="modal-heading"><div><div className="style-pill">{portfolioMaster.styles || 'Авторский стиль'}</div><h2 id="portfolio-title">{portfolioMaster.name}</h2></div><p>{polishedDescription(portfolioMaster.bio) || 'Индивидуальный подход к каждой идее.'}</p></div><div className="portfolio-gallery">{(portfolioMaster.portfolio_urls?.filter(Boolean).length ? portfolioMaster.portfolio_urls!.filter(Boolean).map(url=>mediaUrl(url)) : [0,1,2].map(i=>demoPortfolio(portfolioMaster.styles || 'Авторский стиль',i,masters.findIndex(m=>m.id===portfolioMaster.id)))).map((url,index)=><a className="portfolio-work" href={url} target="_blank" rel="noreferrer" key={`${url}-${index}`}><img src={url} alt={`${demoPortfolioTitle(portfolioMaster.styles || 'Авторский стиль',index)} — ${portfolioMaster.name}`} loading="lazy"/><span>{demoPortfolioTitle(portfolioMaster.styles || 'Авторский стиль',index).toUpperCase()} ↗</span></a>)}</div><button type="button" className="primary modal-book" onClick={()=>{setMasterId(String(portfolioMaster.id));setPortfolioMaster(null);document.getElementById('booking-form')?.scrollIntoView({behavior:'smooth',block:'start'})}}>ЗАПИСАТЬСЯ К МАСТЕРУ ↗</button></section></div>}
 <footer className="site-footer">
  <div className="footer-brand">
    INK HOUSE <span>·</span> MADE TO LAST
  </div>

  <div className="footer-legal">
    <a href="/privacy-policy" target="_blank" rel="noreferrer">
      Политика обработки персональных данных
    </a>
    <p>
      Обработка персональных данных осуществляется
      в соответствии с Федеральным законом № 152-ФЗ.
    </p>
  </div>

  <div className="footer-copy">
    © {new Date().getFullYear()} INK HOUSE
  </div>
</footer>
</main>
}
