const express = require('express')
const Order = require('../models/Order')

const router = express.Router();


//At Route /order/create/:id
router.post('/create/:id', async (req, res) => {

    try {

        const obj = {
            userId: req.params.id,
            userName: req.body.userName,
            product: req.body.product,
            price: req.body.price,
            address: req.body.address,
            image: req.body.image,
            productUrl: req.body.productUrl
        }

        const order = await Order.create(obj)


        res.json({
            success: true,
            msg: "order created"
        })
    } catch (error) {
        res.json({
            success: false,
            error
        })
    }

})




//At Route /order/all
router.get('/all', async (req, res) => {

    try {
        
        const order = await Order.find({});
        // console.log("order ",order)
        res.json({
            success: true,
            totalOrders: order.length,
            order
        })
    } catch (error) {
        console.log(error)
        res.json({
            success: false,
            error
        })
    }

})






//At Route /order/check/:id
router.get('/check/:id', async (req, res) => {

    try {
        
        const order = await Order.find({ userId: req.params.id })

        res.json({
            success: true,
            totalOrders: order.length,
            order
        })    
    } catch (error) {
        console.log(error)
        res.json({
            success: false,
            error
        })    
    }    

})    


//At     GET    /order/get/status-values
router.get('/get/status-values', (req, res) => {
    res.json(Order.schema.path('status').enumValues);
})


//At     PUT    /order/update/order-status
router.put('/update/order-status', async(req, res) => {

    try {
        const response = await Order.findOneAndUpdate( { _id: req.body.orderId }, { status: req.body.status },{ new: true } );

        // console.log( req.body.orderId  )
        res.json({
            msg: "order status updated",
            response
        })
    } catch (error) {
        console.log(error)
    }
})





//At     DELETE    /order/delete/:orderId
router.delete('/delete/:orderId', async(req, res) => {

    try {
        const response = await Order.findByIdAndDelete(  req.params.orderId );

        // console.log( req.body.orderId  )
        res.json({
            msg: "Order Deleted",
            response
        })
    } catch (error) {
        console.log(error)
    }
})




module.exports = router;