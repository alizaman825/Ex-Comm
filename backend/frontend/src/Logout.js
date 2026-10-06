import React from 'react'
import { useHistory } from 'react-router-dom'
import './logout.css'

const Logout = () => {
    let history = useHistory()
    const logout = () => {
        localStorage.removeItem('Token')
        history.push('/')
    }

    return (
        <div>
            <link href="//netdna.bootstrapcdn.com/bootstrap/3.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css" />
            <script src="//netdna.bootstrapcdn.com/bootstrap/3.0.0/js/bootstrap.min.js"></script>
            <script src="//code.jquery.com/jquery-1.11.1.min.js"></script>
            


            <>
                <button onClick={logout} className="button">
                Logout
                </button>
            </>
        </div>
    )
}

export default Logout
