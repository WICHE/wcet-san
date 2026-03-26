import React from 'react';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      keyword: '',
    };
    this.inputRef = React.createRef();
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.showSearch = this.showSearch.bind(this);
  }

  handleSubmit(event) {
    event.preventDefault();
    window.location.href = '/search?key=' + this.state.keyword;
  }

  handleChange(event) {
    this.setState({ keyword: event.target.value });
  }

  showSearch(event) {
    const parent = event.target.parentNode;
    parent.classList.toggle('active');
    if (parent.classList.contains('active')) {
      this.inputRef.current.focus();
    }
  }

  render() {
    return (
      <div className="search-header"> 
        <form className="search-header--form" onSubmit={this.handleSubmit}> 
          <input
            ref={this.inputRef}
            type="text"
            value={this.state.keyword}
            onChange={this.handleChange}
          />
        </form>

        <button onClick={this.showSearch} className="search-header--search-trigger">Search</button>
      </div>
    );
  }
}

export default App;