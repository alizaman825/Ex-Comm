import { React, useState } from 'react'
import axios from 'axios'
import './loginScreen.css'
import { useHistory } from 'react-router-dom'


const LoginScreen = () => {

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    let history = useHistory();

    const submitForm = async(e) => {
        e.preventDefault();

        const user = await axios.post('/users/login',{
            email: email,
            password: password
        })

        console.log("user data", user.data)

        localStorage.setItem("Token", `Bearer ${user.data.token}`)
        
        history.push('/admin')

    }
    
    console.log(email, password)

    return (
        <>
            <div className="container">
                <div className="row">
                    <div className="col-md-6">
                        <div className="card">
                            <form onSubmit={ submitForm } className="box">
                                <h1>Login</h1>
                                <p className="text-muted"> Please enter your login and password!</p>
                                <input type="text" name="" placeholder="Username" onChange={ e => {
                                    setEmail(e.target.value)
                                }} />
                                <input type="password" name="" placeholder="Password" onChange={
                                    (e) => {
                                        setPassword(e.target.value)
                                    }
                                } />
                                <input type="submit" name="" value="Login" />
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default LoginScreen
