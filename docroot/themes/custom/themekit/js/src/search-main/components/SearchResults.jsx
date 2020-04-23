import React from 'react';
import gql from 'graphql-tag';
import Client from '../utils/apollo-gql-client';
import ReactPaginate from 'react-paginate';
import queryString from 'query-string';
import DropdownFilter from "./DropdownFilter";
import ResultItem from "./ResultItem";

class SearchResults extends React.Component {
  /**
   * The constructor is a method that’s automatically called during the creation
   * of an object from a class. It can handle your initial setup stuff like
   * defaulting some properties of the object, or sanity checking the arguments
   * that were passed in. Simply put, the constructor aids in constructing things.
   *
   */
  constructor(props) {
    super(props);
    this.state = {
      indexID: 'index',
      indexName: 'IndexDoc',
      pageSize: 10,
      currentPage: 0,
      offset: 0,
      resultCount: 0,
      results: [],
      userLoggedIn: false,
      keyword: '',
      sort: '',
      init: false,
      facets: [
        { name: 'topic', label: 'Topics', urlParam: 'topic', selected: [], options: [] },
        { name: 'resource_type', label: 'Resource Type', urlParam: 'type', selected: [], options: [] },
      ],
    };
  }

  /**
   * Comment componentDidMount
   */
  componentDidMount = () => {
    const urlParams = queryString.parse(this.props.location.search);
    const facetData = this.state.facets;

    // Get facet params from URL if they exist
    facetData.map((item, index) => {
      if(urlParams[facetData[index].urlParam]) {
        facetData[index].selected.push(urlParams[facetData[index].urlParam]);
      }
    });

    // Update state with query params
    this.setState(preState => {
      return {
        keyword: urlParams.key ? decodeURIComponent(urlParams.key) : preState.keyword,
        sort: urlParams.sort ? decodeURIComponent(urlParams.sort) : preState.sort,
        facets: facetData,
      }
    }, this.queryResults);
  };

  /**
   * Comment convertTime
   */
  convertTime = (unixTimestamp) => {
    let unix = unixTimestamp; // Unixtimestamp
    const months_arr = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']; // Months array
    const date = new Date(unix * 1000); // Convert to milliseconds
    const year = date.getFullYear(); // Year
    const month = months_arr[date.getMonth()]; // Month
    const day = date.getDate() > 9 ? date.getDate() : '0' + date.getDate(); // Day

    return (
      month + '.' + day + '.' + year
    );
  };

  /**
   * Comment handlePageClick
   */
  handlePageClick = (data) => {
    const selectedPage = data.selected;
    const offset = selectedPage * this.state.perPage;

    this.setState({
      currentPage: selectedPage,
      offset: offset
    }, () => {
      this.queryResults();
    });
  };

  /**
   * Comment updateFilter
   */
  updateFilter = (facetName, value) => {
    const facetData = this.state.facets;
    let key = '';
    let newValue = '';

    facetData.map((item, index) => {
      // Find the correct facet object
      if (item.name === facetName) {
        key = item.urlParam;
        // If value is in selected list, remove it
        // Else add value to selected list
        if(facetData[index].selected.includes(value)) {
          const itemIndex = facetData[index].selected.indexOf(value);
          if (itemIndex > -1) {
            facetData[index].selected.splice(itemIndex, 1);
          }
        } else {
          facetData[index].selected.push(value);
          newValue = value;
        }
      }
    });

    // Update state with change
    this.setState({
      facets: facetData,
      pageIndex: 0,
    });
  };

  /**
   * Comment updateSort
   */
  updateSort = (item) => {
    const sort = typeof item === "object" ? item.target.value : item;
    // Update state with change
    if (this.state.sort !== sort) {
      this.setState( {
        sort: sort,
      });
    }
  };

  /**
   * Comment updateResults
   */
  updateResults = (key = null, value = null) => {
    // Get current route
    const data = queryString.parse(this.props.location.search);

    // Update key value and remove null value
    if (value.length || (key === 'page' && value)) {
      if (key === 'page'){
        value = value.toString();
      }
      // If value is array, join as comma separated list
      data[key] = typeof value === 'string' ? value : value.join(',');
    } else {
      delete data[key];
    }

    // Sort keys for better GA tracking
    const sortedData = {};
    Object.keys(data).sort().forEach((i) => {
      sortedData[i] = data[i];
    });

    // Update history only if the route is different then current
    if (JSON.stringify(sortedData) !== JSON.stringify(queryString.parse(this.props.location.search))) {
      this.props.history.push({
        pathname: this.props.location.pathname,
        search: queryString.stringify(sortedData)
      });
    }

    // Update query
    this.queryResults();
  };

  /**
   * Comment sortAlphaAsc
   */
  sortAlphaAsc = (array, key = null) => {
    // Sort array
    array.sort((a, b) => {
      const textA = key ? a[key].toLowerCase() : a.toLowerCase();
      const textB = key ? b[key].toLowerCase() : b.toLowerCase();
      let returnValue = 0;
      if (textA < textB) {
        returnValue = -1;
      } else if (textA > textB) {
        returnValue = 1;
      }
      return returnValue;
    });

    return array;
  };

  /**
   * Comment getAndSortFacets
   */
  getAndSortFacets = (nameKey, myArray) => {
    const direction = 'ASC';
    // Find facet that matches
    let array = [];
    let newArray = [];
    for (let i = 0; i < myArray.length; i += 1) {
      if (myArray[i].name === nameKey) {
        array = myArray[i].values;
        if (direction === 'ASC') {
          newArray = this.sortAlphaAsc(array, 'name');
        }
        break;
      } else {
        newArray = null;
      }
    }
    return newArray;
  };

  /**
   * Comment keywordArray
   */
  keywordArray = (keyword) => {
    // Create array of keywords split on space
    const cleanKeyword = keyword.replace(/[&/\\#,+()$~%.":*?<>{}]/g, '');
    const keywordArray = cleanKeyword.split(/(\s+)/).filter(e => e.trim().length > 0);
    return keywordArray.join('", "');
  };

  handleChange = (event) => {
    this.setState({ keyword: event.target.value });
  };

  handleSubmit = (event) => {
    event.preventDefault();
    this.queryResults();
  };

  clearFilters = () => {
    Object.keys(this.state.facets).forEach((index) => {
      this.state.facets[index].selected = [];
      this.queryResults();
    });
  };

  /**
   * Query results from a GraphQL query using the Apollo API Client. Inserted
   * is the GraphQL query with any state variables inserted, which is ran
   * through the ".then()" function to display results of that query.
   *
   * Here we are only querying NID to reduce load of information, and mapping
   * that information to a React component where ID's are required.
   */
  queryResults = () => {
    // Add filters for the search
    let categoryFilter = '';
    let sortFilter = '';
    let facets = '';
    let fulltextFilter = '';
    const catFilters = [];
    const facetList = [];

    // Add keyword filter
    if (this.state.keyword) {
      fulltextFilter = `fulltext: {keys: ["${this.keywordArray(this.state.keyword)}"]}`;
    }

    // For each facet, check if anything is selected.
    this.state.facets.map((item) => {
      if (item.selected.length > 0) {
        // If there are selected items, add them to the filters.
        Object.keys(item.selected).forEach((key) => {
          catFilters.push(`{name: "${item.name}", value: "${decodeURIComponent(item.selected[key])}", operator: "="}`);
        });
      }
    });

    catFilters.push('{name: "status", value: "true", operator: "="}');

    if (catFilters) {
      categoryFilter = `conditions: [${catFilters.join(',')}]`;
    }

    this.state.facets.map((item) => {
      facetList.push(`{operator: "=", field: "${item.name}", limit: 0, min_count: 0, missing: false}`);
    });

    if (facetList) {
      facets = `facets: [${facetList.join(',')}]`;
    }

    if (this.state.sort) {
      switch (this.state.sort) {
        case 'date':
          sortFilter = 'sort: {field: "created" value: "desc"}';
          break;
        default:
          sortFilter = '';
      }
    }

    Client.query({
      query: gql(`{
        allResults: searchAPISearch(
          index_id: "${ this.state.indexID }"
          range: {offset: ${ this.state.currentPage * this.state.pageSize }, limit: ${ this.state.pageSize }}
          ${ sortFilter }
          ${ categoryFilter }
          ${ fulltextFilter }
          ${ facets }
        ) {
          result_count
          documents {
            ... on ${ this.state.indexName } {
              nid
              title
              type
              url
              resource_type
              color
              topic
              created
              content_access
            }
          }
          facets{
            name
            values{
              count
              name: filter
            }
          }
        }
      }`),
    }).then((result) => {
      const data = result ? result.data.allResults : [];
      const nodes = [];
      const bodyElement = document.querySelector('body');
      data.documents.map(item => {
        nodes.push({
          nid: item.nid,
          title: item.title,
          type: item.type,
          url: item.url,
          resource_type: item.resource_type,
          color: item.color,
          topics: item.topic,
          created: item.created,
          access: item.content_access
        });
      });

      const facetData = this.state.facets;
      facetData.map((item, index) => {
        facetData[index].options = this.getAndSortFacets(item.name, data.facets);
      });

      // Overrides state data from constructor with query data
      this.setState(preState => {
        return {
          results: nodes,
          resultCount: data.result_count,
          pageCount: Math.ceil(data.result_count / this.state.pageSize),
          facets: facetData,
          userLoggedIn: bodyElement.classList.contains('user-logged-in'),
        }
      });
    });
  };

  /**
   * Every React class component requires a render object.
   * @returns
   */
  render() {
    // Keyword
    const resultKeyword = this.state.keyword;

    // Facets
    const facetItems = this.state.facets.map(item =>
      <DropdownFilter
        key={ item.name }
        item={ item }
        updateFilter={ this.updateFilter }
      />
    );

    // Results comment
    const results = this.state.results.map((result) => {
      return (
        <ResultItem
          key={ result.nid }
          title={ result.title }
          type={ result.type }
          url={ result.url }
          resource_type={ result.resource_type }
          color={ result.color }
          topics={ result.topics.join(', ') }
          created={ this.convertTime(result.created) }
          access={ result.access }
          userLoggedIn={ this.state.userLoggedIn }
        />
      )
    });

    // Pagination comment
    let pagination;
    if (this.state.pageCount > 1) {
      pagination = (
        <ReactPaginate
          previousLabel={ 'Previous' }
          nextLabel={ 'Next' }
          breakLabel={ <span className='gap'>...</span> }
          pageCount={ this.state.pageCount }
          onPageChange={ this.handlePageClick }
          forcePage={ this.state.currentPage }
          containerClassName={ 'pagination' }
          previousLinkClassName={ 'previous_page' }
          nextLinkClassName={ 'next_page' }
          disabledClassName={ 'disabled' }
          activeClassName={ 'active' }
        />
      );
    }

    return (
      <div className="search-main">
        <div className="search-main--keyword">
          <input type="text" placeholder={ resultKeyword } onChange={ this.handleChange }/>
          <button className="form-submit" onClick={ this.handleSubmit }>Submit</button>
        </div>

        <div className="search-main--result-data">
          <strong>{ this.state.currentPage + 1 }-{ this.state.pageCount } </strong>
          of <strong>{ this.state.resultCount } results </strong>
          { resultKeyword !== '' ? "for" : '' } <em>{ resultKeyword }</em>
        </div>

        <div className="search-main--facets">
          <div className="filters">
            { facetItems }
          </div>

          <div className="sort">
            <label>Sort By:</label>
            <select id="sortby" name="sortby" defaultValue={ this.state.sort } onChange={ this.updateSort }>
              <option value="">Sort by Relevancy</option>
              <option value="date">Sort by Date</option>
            </select>
          </div>

          <button className="form-submit" onClick={ this.handleSubmit }>Apply</button>
          <button className="clear-filters" onClick={ this.clearFilters }>Clear Filter</button>
        </div>

        <div className="search-main--results">
          { results }
        </div>

        <div className="search-main--pagination">
          { pagination }
        </div>
      </div>
    )
  }
}

export default SearchResults;
