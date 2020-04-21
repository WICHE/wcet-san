import React from 'react';
import { BrowserRouter as Router, Route } from "react-router-dom";
import SearchResults from "./components/SearchResults"

class App extends React.Component {
  render() {
    return (
      <Router>
        <Route path="/search" component={SearchResults} />
      </Router>
    )
  }
}

export default App;
