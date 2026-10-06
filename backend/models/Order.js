const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: [true,'please enter user id'],
        trim : true,
        maxlength: [50, 'Maximum length should bd 50']
    },
    userName: {
        type: String,
        trim: true
    },
    product: {
        type: String
    },
    price: {
        type: Number
    },
    address: {
        type: String
    },
    status:{
        type: String,
        default: "Not Processed",
        enum: ["Not Processed", "Processing", "Shipped", "Delivered", "Canceled"]
    },
    productUrl:{
        type: String
    },
    image: {
        type: String
    },
    updated: Date

}, { timestamps: true } )


module.exports = mongoose.model('order',orderSchema)