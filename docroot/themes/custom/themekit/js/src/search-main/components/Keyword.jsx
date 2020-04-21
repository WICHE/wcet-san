import React from 'react';
import Autosuggest from 'react-autosuggest';
import gql from 'graphql-tag';
import Client from '../utils/apollo-gql-client';

/**
 * Define query and suggestions first, to use in component
 * @type {*[]}
 */
let suggestions = [];
function  querySuggestions() {
  Client.query({
    query: gql(`{
      allResults: searchAPISearch(
        index_id: "index"
        range: {offset: 0, limit: 2000}
        conditions: [
          {name: "status", value: "true", operator: "="}
        ]
      ) {
        result_count
        documents {
          ... on IndexDoc {
            nid
            title
          }
        }
      }
    }`),
  }).then((result) => {
    suggestions = result ? result.data.allResults.documents : [];
  });
} querySuggestions();

// Teach Autosuggest how to calculate suggestions for any given input value.
const getSuggestions = value => {
  const inputValue = value.trim().toLowerCase();
  const inputLength = inputValue.length;

  return inputLength === 0 ? [] : suggestions.filter(item =>
    item.title.toLowerCase().slice(0, inputLength) === inputValue
  );
};

// When suggestion is clicked, Autosuggest needs to populate the input
// based on the clicked suggestion. Teach Autosuggest how to calculate the
// input value for every given suggestion.
const getSuggestionValue = suggestion => suggestion.title;

// Use your imagination to render suggestions.
const renderSuggestion = suggestion => (
  <div>
    <div className="title-wrap">
      <div className="title">
        {suggestion.title}
      </div>
    </div>
  </div>
);

class Keyword extends React.Component {
  constructor(props) {
    super(props);

    // Autosuggest is a controlled component.
    // This means that you need to provide an input value
    // and an onChange handler that updates this value (see below).
    // Suggestions also need to be provided to the Autosuggest,
    // and they are initially empty because the Autosuggest is closed.
    this.state = {
      value: '',
      suggestions: [],
      init: true,
    };
  }

  componentDidUpdate(nextProps) {
    if (this.state.value != this.props.value && this.state.init) {
      this.setState( prevState => {
        return {
          value: this.props.value,
          init: false,
        }
      });
    }
  }

  onChange = (event, { newValue, method }) => {
    this.setState({
      value: newValue
    });

    if(method === 'click' || method === 'enter') {
      this.props.updateKeyword(newValue);
    }
  };

  onKeyPress = (e) => {
    if(e.key === 'Enter'){
      this.props.updateKeyword(document.querySelector('.react-autosuggest__input').value);
    }
  };

  // Autosuggest will call this function every time you need to update suggestions.
  // You already implemented this logic above, so just use it.
  onSuggestionsFetchRequested = ({ value }) => {
    this.setState({
      suggestions: getSuggestions(value)
    });
  };

  // Autosuggest will call this function every time you need to clear suggestions.
  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: []
    });
  };

  render() {
    const { value, suggestions } = this.state;

    // Autosuggest will pass through all these props to the input.
    const inputProps = {
      placeholder: 'Search',
      value,
      onChange: this.onChange,
      onKeyPress: this.onKeyPress
    };

    // Finally, render it!
    return (
      <Autosuggest
        suggestions={suggestions}
        onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
        onSuggestionsClearRequested={this.onSuggestionsClearRequested}
        getSuggestionValue={getSuggestionValue}
        renderSuggestion={renderSuggestion}
        inputProps={inputProps}
      />
    );
  }
}

export default Keyword;
