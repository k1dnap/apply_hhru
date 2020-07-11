const puppeteer = require('puppeteer');
const fs = require('fs').promises;

const text_prefix = `Здравствуйте! Прошу вас рассмотреть мою кандидатуру на данную вакансию.\n\n`
const text_postfix = `\nС уважением, Владислав.`
const resume_naming = `Программист-разработчик`
const apply_limit = 30;

const gotoPage = async (page, url)=>{
  let done;
  while(!done){
    try {
      await page.goto(url, {timeout: 100000, waitUntil:`networkidle2`})
      done = true;
    } catch (e) {
      //failed
    }
  }
  return 1;
};

const search_params = [
  {
    keywords: [`node.js`, `node`, `nodejs`],
    text: `Имею опыт написания приложений с использованиыем nodejs, приемущественно использую Express, mongoDB, react.`
  },
  {
    keywords: [`react`, `react.js`, `reactjs`],
    text: `Имею опыт написания интерфейсов с использованием react, приемущественно использую в связке с next.js.`
  },
  {
    keywords: [`vue`],
    text: `Имею маленький опыт написания интерфейсов с использованием vue, понимаю экосистему, но опыта разработки чего-то масштабного не было.`
  },
  {
    keywords: [`python`],
    text: `Имею опыт написания приложений с использованиыем python: Django, flask, requests, bs4, selenium, numpy, openCV.`
  },
  {
    keywords: [`docker`],
    text: `Есть опыт запаковывания простых приложений в docker. Имею огромное желание подтянуть свои навыки с данной технологией.`
  },
  {
    keywords: [`HTML`, `JS`, `jquery`, `bootstrap`],
    text: `Имеется опыт верстки, предпочитаю bootstrap + JS.`
  },
  {
    keywords: [`selenium`, `puppeteer`, `cheerio`, `requests`, `beautifulsoup`, `beautiful soup`, `bs4`],
    text: `Имею опыт написания парсеров с использованием Beautifulsoup, Selenium, puppeteer, cheerio.  Но предпочитаю использовать аналоги на javascript.`
  },
  {
    keywords: [`php`],
    text: `Опыта разработки с использованием php, но если у вас используется symfony и рассматриваете сотрудника на должность стажера/juniorа, то был бы рад присоединиться к вашей команде.`
  },
  {
    keywords: [`git`],
    text: `Git - на уровне push/pull/reset в мастер, опыта работы в команде, к сожалению, не было.`
  }
];
let exclude_vacancy_keywords = [`1C`, `1С`, `C++`];
exclude_vacancy_keywords = exclude_vacancy_keywords.map(el=>el.toLowerCase())
let temp;

try {
  temp = require('./temp.json')
} catch (e) {
  temp = {
    already_applied : []
  }
};
const updateTemp = async ()=>{
  await fs.writeFile('./temp.json', JSON.stringify(temp, null, 2));
  return 1;
};

const disableImages = async (page) =>{
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.resourceType() === 'image') request.abort();
    else request.continue();
  });
  return 1
}
const main = async () =>{
  let process_finished = false;
  while(!process_finished){
    let browser = await puppeteer.launch({headless: false, userDataDir:`./profile`,  defaultViewport: null})
    const page = (await browser.pages())[0]
    await disableImages(page);
    await page.goto(`https://hh.ru/applicant/autosearch.xml`, {timeout: 100000, waitUntil:`networkidle2`})
    let first_search_url = await page.evaluate( ()=>{
      return document.querySelector('div.saved-search-item__footer').querySelector('a').href
    });
    // change sort to by date
    first_search_url = first_search_url.split('?').join('?order_by=publication_time&');
    await page.goto(first_search_url, {timeout: 100000 , waitUntil:`networkidle2` });
    let cycle_finished = false;
    let applied_this_cycle = 0;
    while(!cycle_finished){
      // extract search results
      let search_results = await page.evaluate( ()=>{
        let data = [];
        Array.from(document.querySelector('div.vacancy-serp').querySelectorAll('div.vacancy-serp-item'))
          .map(el=>{
            // ignore already applied for (green text one);
            try {
              if (el.querySelector('a[data-qa="vacancy-serp__vacancy_responded"]').querySelector('script') == null) return 1;
            } catch (e) {}
            try {
              if (el.querySelector('a[data-qa="vacancy-serp__vacancy_rejected"]').querySelector('script') == null) return 1;
            } catch (e) {}
            let a_el = el.querySelector('span.g-user-content').querySelector('a')
            let vacancy = {};
            vacancy.href = a_el.href;
            vacancy.title = a_el.textContent;
            vacancy.applied = false;
            vacancy.employer = el.querySelector('a[data-qa="vacancy-serp__vacancy-employer"]').textContent;
            if (a_el.getAttribute('data-position')) vacancy.href += `?position=`+a_el.getAttribute('data-position')
            if (a_el.getAttribute('data-requestid')) vacancy.href += `&requestId=`+a_el.getAttribute('data-requestid')
            if (a_el.getAttribute('data-totalvacancies')) vacancy.href += `&totalVacancies=`+a_el.getAttribute('data-totalvacancies')
            data.push(vacancy)
          })
        return data;
      });
      
      // sort them
      // sort search results by keywords
      search_results = search_results.filter(el=>{
        if (exclude_vacancy_keywords.some(keyword=> el.title.toLowerCase().includes(keyword))) return false;
        else return true;
      });
      // sort search results by temp
      search_results = search_results.filter(el=>(!temp.already_applied.includes(`${el.title} ${el.employer}`)));
    
      const applyForVacancy = async (vacancy)=>{
        const page = await browser.newPage();
        await disableImages(page);
        
        await page.goto(vacancy.href, {timeout: 100000, waitUntil:`networkidle2`})
        
        //create text for apply
        let high_q = `Здравствуйте! Я увидел то что вы набираете сотрудников на высокую должность, но мало ли, вам требуются стажеры/junior'ы.\n\n`
        let apply_text = text_prefix;
        
        let vacancy_text = await page.evaluate( ()=>{
          return document.querySelector('div[data-qa="vacancy-description"]').textContent;
        });
        let vacancy_title = await page.evaluate( ()=>{
          return document.querySelector('h1').textContent.toLowerCase();
        });
        ['senior', `techlead`, `tech-lead`, `tech lead`, `Ведущий разработчик`].map(keyword=>{
          if (vacancy_title.includes(keyword)) apply_text = high_q;
        });
        search_params.map(param =>{
          if( param.keywords.some(keyword=>vacancy_text.toLowerCase().includes(keyword)) ) apply_text += param.text + `\n`;
        })
        apply_text += text_postfix
        
        //configure apply
        await page.evaluate( ()=>{
          document.querySelector('a.HH-VacancyResponsePopup-Link').click();
        })
        await new Promise(r=>setTimeout(r,1000));
        //close 'other country' window
        try {
          await page.evaluate( ()=>{
            document.querySelectorAll('span.bloko-button.bloko-button_small.bloko-button_secondary.HH-RespondCheck-Approve')[1].click();
          });
          await new Promise(r=>setTimeout(r,1000));
        } catch (e) {
          
        }
    
    
        await page.evaluate( (resume_naming)=>{
          try {
            Array.from(document.querySelectorAll('span.bloko-radio__text'))
            .find(el=>el.textContent.toLowerCase()==resume_naming.toLowerCase())
              .click();
          } catch (e) {
          };
    
          try {
            document.querySelector('span[data-qa="vacancy-response-letter-toggle"]').click();
          } catch (e) {
            
          }
        }, resume_naming);
        await new Promise(r=>setTimeout(r,1000));
        await page.evaluate( ()=>{
          document.querySelector('textarea.HH-VacancyResponsePopup-Letter').focus();
        });
    
        //input apply msg
        page.keyboard.sendCharacter(apply_text);
        await new Promise(r=>setTimeout(r,1000));

        //apply procces itself using apply_text;
        await page.evaluate( ()=>{
          document.querySelector('button.bloko-button.bloko-button_primary.HH-VacancyResponsePopup-Submit.HH-SubmitDisabler-Submit').click()
        });
        //update temp file;
        temp.already_applied.push(`${vacancy.title} ${vacancy.employer}`)
        await updateTemp();
        applied_this_cycle +=1;
        await new Promise(r=>setTimeout(r, 5 * 1000));
        await page.close();
        return 1;
      }
      for (const vacancy of search_results) {
        if(applied_this_cycle >= apply_limit) {
          cycle_finished = true;
          break;
        }
        if(temp.already_applied.includes(`${vacancy.title} ${vacancy.employer}`)) continue;
        await applyForVacancy(vacancy);
      };
      const gotoNextPage = async (page)=>{
        // 0 - no more pages
        // 1 - success;
        let res = await page.evaluate( ()=>{
          let arr = Array.from(document.querySelectorAll('span.bloko-button-group span'))
          let is_next = false;
          for (const obj of arr) {
            if (is_next) {
              return obj.querySelector('a').href;
            };
            if(obj.getAttribute(`class`).includes('button_pressed')) is_next = true;
          };
          return 0;
        })
        if (res == 0) return 0;
        else await page.goto(res, {timeout: 100000, waitUntil:`networkidle2`})
        return res;
      }
      if(applied_this_cycle < apply_limit) {
        let res = await gotoNextPage(page);
        if (res == 0) {
          process_finished = true;
          break;
        }
        else continue;
      };
    };
    
    await browser.close();
    if (process_finished) break;
    console.log('sleeping for 1 hour;')
    await new Promise(r=>setTimeout(r, 1000 * 60 * 60))
  };
  console.log(`done!`)
};

main(); 