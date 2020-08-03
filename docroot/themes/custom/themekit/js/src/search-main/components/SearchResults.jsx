import React from 'react';
import gql from 'graphql-tag';
import Client from '../utils/apollo-gql-client';
import ReactPaginate from 'react-paginate';
import queryString from 'query-string';
import DropdownFilter from "./DropdownFilter";
import ResultItem from "./ResultItem";

class SearchResults extends React.Component {
  /**
   * The constructor is a method that’s automatically called during the
   * creation
   * of an object from a class. It can handle your initial setup stuff like
   * defaulting some properties of the object, or sanity checking the arguments
   * that were passed in. Simply put, the constructor aids in constructing
   * things.
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
        { name: 'topic', label: 'Topics', urlParam: 'topic', selected: '', options: [] },
        { name: 'resource_type', label: 'Resource Type', urlParam: 'type', selected: '', options: [] },
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
      if(urlParams[facetData[index].urlParam] !== undefined) {
        facetData[index].selected = decodeURIComponent(urlParams[facetData[index].urlParam]);
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
   * Comment truncateContent
   */
  truncateStripContent = (content) => {
    const contentStripped = content.replace(/(<([^>]+)>)/ig, "");
    return contentStripped.slice(0, 150) + '...';
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
   * Comment updateKeyword
   */
  updateKeyword = (value) => {
    // Update state with change
    this.setState(preState => {
      return {
        keyword: value,
        pageIndex: 0,
      }
    }, () => {
      this.updateResults('key', value);
    });
  };

  /**
   * Comment updateFilter
   */
  updateFilter = (facetName, value) => {
    const facetData = this.state.facets;

    facetData.map((item, index) => {
      if (item.name === facetName) {
        facetData[index].selected = value;
      }
    });

    // Update state with change
    this.setState(preState => {
      return {
        facets: facetData,
        pageIndex: 0,
      }
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
  updateResults = (key = null, value = null, runQuery = true) => {
    // Get current route
    const data = queryString.parse(this.props.location.search);

    // Update key value and remove null value
    if (value.length || (key === 'page' && value)) {
      if (key === 'page'){
        value = value.toString();
      }
      // If value is array, join as comma separated list
      data[key] = typeof value === 'string' ? encodeURIComponent(value) : encodeURIComponent(value.join(','));
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
    if (runQuery) {
      this.queryResults();
    }
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

  handleSubmit = (event, key) => {
    event.preventDefault();
    // this.updateKeyword(this.state.keyword);
    switch (key) {
      case 'keyword':
        this.updateKeyword(this.state.keyword);
        break;
      case 'filter':
        this.state.facets.forEach((facets, index) => {
          // only want to run query when we want to run - on filter change
          if (this.state.facets.length === index) {
            this.updateResults(facets.urlParam, facets.selected, false);
          } else {
            this.updateResults(facets.urlParam, facets.selected, true);
          }
        });
        break;
    }
  };

  clearFilters = () => {
    const filters = document.querySelectorAll('.filter select');

    Object.keys(this.state.facets).forEach((index) => {
      this.state.facets[index].selected = [];
      this.queryResults();
    });

    filters.forEach((select) => {
      select.value = "";
    })
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
          catFilters.push(`{name: "${item.name}", value: "${ item.selected }", operator: "="}`);
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
              processed
              description
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
        const description = item.description ? item.description
          : item.processed && item.type === 'page' ? this.truncateStripContent(item.processed)
          : null;

        nodes.push({
          nid: item.nid,
          title: item.title,
          type: item.type,
          url: item.url,
          resource_type: item.resource_type,
          color: item.color,
          topics: item.topic,
          created: item.created,
          access: item.content_access,
          description: description,
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

    // Result count
    let resultsLast = this.state.currentPage * this.state.pageSize + this.state.pageSize;
    if (this.state.resultCount <= resultsLast) {
      resultsLast = this.state.resultCount;
    }

    // Facets
    const facetItems = this.state.facets.map(item =>
      <DropdownFilter
        key={ item.name }
        item={ item }
        updateFilter={ this.updateFilter } //@params = facetName, value
      />
    );

    // Results comment
    let results = [];
    if (this.state.results === undefined || this.state.results.length === 0) {
      results = "Sorry, no results were found";
    } else {
      results = this.state.results.map((result) => {
        return (
          <ResultItem
            key={result.nid}
            title={result.title}
            type={result.type}
            url={result.url}
            resource_type={result.resource_type}
            color={result.color}
            topics={result.topics.join(', ')}
            created={this.convertTime(result.created)}
            access={result.access}
            userLoggedIn={this.state.userLoggedIn}
            summary={result.summary}
            description={result.description}
          />
        )
      });
    }

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
          <button className="form-submit" onClick={ e => this.handleSubmit(e, 'keyword') }>Search</button>
        </div>

        <div className="search-main--result-data">
          <strong>{ this.state.currentPage * this.state.pageSize + 1 }-{ resultsLast } </strong>
          of <strong>{ this.state.resultCount } results </strong>
          { resultKeyword !== '' ? "for" : '' } <em>{ resultKeyword }</em>
        </div>

        <div className="search-main--facets">
          <div className="filters">
            <div className="filter type-topic">
              <div id="toggle-topic" className="filter-list">
                <label>Topics:</label>
                <select onChange={ (e) => this.updateFilter('topic', e.target.value) } value={this.state.facets[0].selected}>
                  <option value="">All Topics</option>
                  <option value="compliance requirements (nonsara)">Compliance Requirements (nonsara)</option>
                  <option value="federal regulations">Federal Regulations</option>
                  <option value="getting started">Getting Started</option>
                  <option value="history">History</option>
                  <option value="military students">Military Students</option>
                  <option value="other higher education issues">Other Higher Education Issues</option>
                  <option value="professional licensure">Professional Licensure</option>
                  <option value="reciprocity (sara)">Reciprocity (sara)</option>
                  <option value="sansational awards">Sansational Awards</option>
                  <option value="student complaints">Student Complaints</option>
                </select>
              </div>
            </div>

            <div className="filter type-resource_type">
              <div id="toggle-resource_type" className="filter-list">
                <label>Resource Type:</label>
                <select onChange={ (e) => this.updateFilter('resource_type', e.target.value) } value={this.state.facets[1].selected}>
                  <option value="">All Resource Types</option>
                  <option value="article (wcet frontiers)">Article (WCET Frontiers)</option>
                  <option value="coordinator call">Coordinator Calls</option>
                  <option value="enewsletter">eNewsletters</option>
                  <option value="research">Research</option>
                  <option value="talking points (white papers)">Talking Points (white papers)</option>
                  <option value="past webinars, events &amp; podcasts">Past Webinars, Events & Podcasts</option>
                </select>
              </div>
            </div>
          </div>

          <div className="sort">
            <label>Sort By:</label>
            <select id="sortby" name="sortby" defaultValue={ this.state.sort } onChange={ this.updateSort }>
              <option value="">Sort by Relevancy</option>
              <option value="date">Sort by Date</option>
            </select>
          </div>

          <button className="form-submit" onClick={ e => this.handleSubmit(e, 'filter') }>Apply</button>
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
