import React from "react";

function ResultItem(props) {
  const isLoggedIn = props.userLoggedIn;
  const access = props.access;
  const url =
    `${ !isLoggedIn && access === 'private'
      ? '/user/login?destination=' + props.url
      : props.url
    }`
  ;
  const classes =
    `search-result
    ${ props.type }
    ${ props.color != null ? props.color : ''}
    ${ !isLoggedIn && access === 'private' ? 'private' : ''}`
  ;

  return (
    <div className={ classes }>
      <a className="search-result--link" href={ url }>link</a>
      { props.type === "resource" &&
        <div className="search-result--info">
          <div className="search-result--resource-type">{ props.resource_type }</div>
          <div className="search-result--created">{ props.created }</div>
        </div>
      }

      <div className="search-result--title">{ props.title }</div>

      { props.type === 'resource' &&
        <div className="search-result--topics">{ props.topics }</div>
      }

      { props.type === 'landing_page' || props.type === 'page' &&
        <div className="search-result--description">{ props.description }</div>
      }
    </div>
  )
}

export default ResultItem;
