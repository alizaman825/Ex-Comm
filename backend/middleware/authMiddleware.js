const jwt = require('jsonwebtoken')
const User = require('../model/User')

const protect = async (req, res, next) => {

    let token

    
    
    if( req.headers.authorization && req.headers.authorization.startsWith('Bearer') ){
        
        try {
            token = req.headers.authorization.split(' ')[1]
            const decode =  jwt.verify(token, process.env.SECRET_TOKEN)
            req.user = await User.findById(decode.id)
            next()
        } catch (error) {
            return res.json({
                msg: 'not authorize , no token'
            })
        }

        
    }

    if(!token){
        // console.log('no token')
        return res.json({
            msg: 'not authorize , no token'
        })
    }
}


module.exports = { protect }