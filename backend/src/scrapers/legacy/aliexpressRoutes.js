const express = require('express')
const getData = require('../util/getData')
const cheerio = require('cheerio')

const router = express.Router();


//At Route /getdata/mens-clothing
router.get('/mens-clothing', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/100003070/men-clothing.html"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})





//At Route /getdata/womens-clothing
router.get('/womens-clothing', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/100003109/women-clothing.html"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})








//At Route /getdata/phone-telecommunication
router.get('/phone-telecommunication', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/509/cellphones-telecommunications.html?spm=a2g0o.productlist.103.1.264a443faxzYMD"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})











//At Route /getdata/computer-office
router.get('/computer-office', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/7/computer-office.html?spm=a2g0o.productlist.104.1.8dd5bbfaFewdf9"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})













//At Route /getdata/consumer-electronics
router.get('/consumer-electronics', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/44/consumer-electronics.html?spm=a2g0o.productlist.105.1.b08d3043hpaxNh"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})
















//At Route /getdata/watches
router.get('/watches', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/1511/watches.html?spm=a2g0o.productlist.106.2.2a732abekNd6bL&isCates=y"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})


















//At Route /getdata/home
router.get('/home', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/15/home-garden.html?spm=a2g0o.productlist.0.0.3c5d13ebkzczl6"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})




















//At Route /getdata/toys-kids
router.get('/toys-kids', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/1501/mother-kids.html?spm=a2g0o.productlist.109.2.6d6843deXxboXn"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})






















//At Route /getdata/bags-luggage
router.get('/bags-luggage', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/1524/luggage-bags.html?spm=a2g0o.productlist.108.1.4dcb2dcbQFXMW8"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})

























//At Route /getdata/beauty-health
router.get('/beauty-health', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/66/beauty-health.html"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})




























//At Route /getdata/outdoor-sports
router.get('/outdoor-sports', async (req, res) => {

    // const url = req.body.url
    const url = "https://www.aliexpress.com/category/18/sports-entertainment.html?spm=a2g0o.productlist.110.1.3a4f6af78TjIkg"
    // console.log(url)

    const productsHtmlArray =  await getData(url)

    const products = []

    // await console.log(products)
    await productsHtmlArray.forEach(productHtml => {
        $ = cheerio.load(productHtml)

        let productName = $('div[class="_2mXVg _89Qo8"] > a > span').text().trim();
        let productUrl = $('div[class="_2mXVg _89Qo8"] > a').attr('href')
        let productImage = $('a[class="_9tla3"] > img').attr('src');
        let productPrice = $('div[class="_12A8D"] ').text();


        obj = {
            productName,
            productUrl: "https://www.aliexpress.com" + productUrl,
            productImage,
            productPrice
        }
        products.push(obj)

    });




    res.json({
        success: true,
        total: products.length,
        products: products
    })

})




module.exports = router