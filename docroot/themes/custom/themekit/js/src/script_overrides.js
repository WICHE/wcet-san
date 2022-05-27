import $ from 'jquery';

const tableElement = $('.node--type-resource-table table');

$(tableElement).on("scroll", function () {
  if($(this).scrollLeft() > 0) {
    $(this).hasClass("scrolling") ? "" : $(this).addClass("scrolling");
  } else {
    $(this).hasClass("scrolling") ? $(this).removeClass("scrolling") : "";
  }
});

function checkOverflow(el) {
  // If node--type-resource-table is found
  if(el.length > 0) {
    const headerOverflow = el[0].tHead.clientWidth;
    const curOverflow = el[0].clientWidth;

    if (!curOverflow || curOverflow === 'visible') { el.style.overflow = 'hidden'; }

    const isOverflowing = curOverflow < headerOverflow;

    return isOverflowing;
  }
}

if(checkOverflow(tableElement) === true) {
  $(tableElement).addClass("scrollable");
  var scroll_hint = document.createElement("span");
  $(scroll_hint).addClass("scroll-hint");
  $(tableElement)[0].parentElement.classList.add("show-scroll-hint");
  $(tableElement)[0].parentElement.prepend(scroll_hint);
}
