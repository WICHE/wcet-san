import React from 'react';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      keyword: '',
    };
  }

  handleSubmit = (event) => {
    event.preventDefault();
    window.location.href = '/search?key=' + this.state.keyword;
  };

  handleChange = (event) => {
    this.setState({ keyword: event.target.value });
  };

  showSearch = (event) => {
    event.target.parentNode.classList.toggle('active');
  };

  render() {
    return (
      <div className="search-header">
        <form className="search-header--form" onSubmit={ this.handleSubmit }>
          <input type="text" value={ this.state.keyword } onChange={ this.handleChange }/>
        </form>

        <button onClick={ this.showSearch } className="search-header--search-trigger">Search</button>
      </div>
    )
  }
}

export default App;
