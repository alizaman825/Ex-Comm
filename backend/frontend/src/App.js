import React from 'react'
import AdminScreen from './AdminScreen'
import LoginScreen from './LoginScreen'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'


const App = () => {

  return (
    <Router>
      <Switch>
        <Route exact path="/">
          <LoginScreen />
        </Route>

        {localStorage.getItem('Token') ? (
          <Route exact path="/admin">
            <AdminScreen />
          </Route>

        ) : (
          <Route exact path="/">
            <LoginScreen />
          </Route>
        )}
      </Switch>
    </Router>
  )
}

export default App
