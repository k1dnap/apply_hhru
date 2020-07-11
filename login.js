const puppeteer = require('puppeteer');

const main = async () =>{
  let browser = await puppeteer.launch({headless: false, userDataDir:`./profile`})
  const page = (await browser.pages())[0]
  await page.goto('https://hh.ru/account/login?backurl=%2F', {timeout: 100000 ,  defaultViewport: null })
  await new Promise(r=>setTimeout(r, 1000 * 1000));
  await browser.close();
};

main();