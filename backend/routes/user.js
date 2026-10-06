const express = require('express')
const User = require('../models/User')
const bcrypt = require('bcryptjs')
const generateToken = require('../util/generateToken')
// const { protect } = require('../middleware/authMiddleware')

const router = express.Router()



//POST  /users/login
// Authenticate User email and password
router.post('/login', async (req, res) => {


    try {
        const user = await User.findOne({ email: req.body.email })

        if (user && (await bcrypt.compare(req.body.password, user.password))) {

            const token = generateToken(user._id) //generate token for the logedin user

            return res.json({
                success: true,
                _id: user._id,
                email: user.email,
                token: token

            })

        } else {
            return res.status(401).json({
                msg: 'Invalid email or password'
            })
        }

    } catch (error) {
        console.log(error)

        return res.json({
            error: error
        })

    }



})




//POST  /users/register
// register User email and password
router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10)

    const obj = {
        email,
        password: hashedPassword
    }


    try {
        const user = await User.create(obj)

        return res.status(200).json({
            success: true,
            user: 'User Created',
            user
        })
    } catch (error) {
        return res.json({
            error: error
        })
    }

})






//DELETE  /users/delete/:id
// register User email and password
router.delete('/delete/:id', async (req, res) => {

    try {
        const user = await User.findByIdAndDelete(req.params.id)

        return res.status(200).json({
            success: true,
            user: `User Deleted`
        })
    } catch (error) {
        console.log(error)
        return res.json({
            error: error
        })
    }

})



//GET    /users/
// get all the users
router.get('/', async (req, res) => {



    try {
        const users = await User.find({});


        res.json({
            success: true,
            users: users
        })

    } catch (error) {
        console.log(error)

        return res.json({
            msg: 'error in getting all users',
            error: error
        })

    }



})




module.exports = router;

