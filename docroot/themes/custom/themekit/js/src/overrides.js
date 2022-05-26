import $ from 'jquery';

const tableElement = $('.node--type-resource-table table');

$(tableElement).on("scroll", function () {
  if($(this).scrollLeft() > 0) {
    $(this).hasClass("scrolling") ? "" : $(this).addClass("scrolling");
  } else {
    $(this).hasClass("scrolling") ? $(this).removeClass("scrolling") : "";
  }
});
