import React from "react";

function ResultItem(props) {
  const classes = `search-result ${ props.type } ${ props.color != null ? props.color : ''}`;
  const url = `${ props.url }`;

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

      { props.topics != null &&
        <div className="search-result--topics">{ props.topics }</div>
      }
    </div>
  )
}

export default ResultItem;
