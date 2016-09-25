//main reddit object
function Reddit() {
  setPost = function(c, p) {
    var rank = 0;
    for (var i in c) {
      var thumb;
      //optionally add thumbnail
      if (typeof c[i].data.thumbnail !== "undefined" && c[i].data.thumbnail !== "self") {
        thumb = c[i].data.thumbnail;
      } else {
        thumb = false;
      }
      p.push({
        id : ++rank,
        title : c[i].data.title,
        url : c[i].data.url,
        score : c[i].data.score,
        permalink : c[i].data.permalink,
        numcomments : c[i].data.num_comments,
        thumbnail : thumb
      });
    }
  };
  this.get = function(v) {
    v = v.toLowerCase();
    HTTP.get("http://www.reddit.com/r/" + v + "/.json", function(err,result) {
      if (result.data) {
        var c, post, colorSum = 0;
        c = result.data.data.children;
        post = [];
        setPost(c,post);

        for (var i=0; i<v.length; i++)
          if (i % 2 == 0)
            colorSum += Math.pow(v.charCodeAt(i),2)
          else
            colorSum -= Math.pow(v.charCodeAt(i),2)

        Session.setPersistent('currID',Session.get('currID') + 1)
        Session.setPersistent('subreddits', Session.get('subreddits').concat({
          id : Session.get('currID'),
          title : v,
          post : post,
          color : colorSum
        }))
      }
    });
  };
  this.refresh = function() {
    var subs = Session.get('subreddits');
    var completedReq = 0;
    _.each(subs,function(sub) {
      HTTP.get("http://www.reddit.com/r/" + sub.title + "/.json", function(err,result) {
        if (result.data) {
          var c = result.data.data.children;
          var post = [];
          setPost(c,post);

          sub.post = post;
        }
        completedReq++;
        if (completedReq == subs.length) {
          Session.setPersistent('subreddits', subs);
        }
      });
    });
  }
}
reddit = new Reddit();

if (Meteor.isClient) {
  // initialize sessions to an empty array
  Session.setDefault('subreddits', []);
  Session.setDefault('currID', 0);
  Session.setDefault('linkstate',false);
  Session.setDefault('scrollLeft',0)

  //subreddits
  Template.subreddits.helpers({
    subreddits : function() {
      return Session.get('subreddits')
    }
  });

  //body
  Template.body.helpers({
    isWindow : function() {
      if (Session.get("linkstate") == 1)
        return true;
      else {
        return false;
      }
    },
    isTab : function() {
      if (Session.get("linkstate") == 2)
        return true;
      else {
        return false;
      }
    },
    isNormal : function() {
      if (Session.get("linkstate") == 3)
        return true;
      else {
        return false;
      }
    }
  });
  Template.body.events({
    "submit #search" : function(e) {
      e.preventDefault();
      if (Session.get('subreddits').length == 0) //reset id when no subreddits
        Session.setPersistent('currID',0);

      var v = e.target.search.value;

      reddit.get(v);

      e.target.search.value = "";
    },
    "submit #login" : function(e) {
      e.preventDefault();
      if (Accounts.loginServicesConfigured())
        Meteor.loginWithReddit(function(e) {
          console.log(Meteor.user());
        });
      else
        console.log("service configuration failed");
    },
    "click header input.window" : function() {
      Session.setPersistent("linkstate",1);
    },
    "click header input.tab" : function() {
      Session.setPersistent("linkstate",2);
    },
    "click header input.normal" : function() {
      Session.setPersistent("linkstate",3);
    },
    "click header .title, click .overlay, click header .up" : function() {
      if ($('.title').hasClass('open')) {
        $('.title').removeClass('open');
        $('.overlay, header .up').stop().fadeOut();
        $('body').stop().animate({'top' : "0"});
        return;
      }
      $('.title').addClass('open');
      $('.overlay, header .up').stop().fadeIn();
      $('body').stop().animate({'top' : "150px"});
    },
    "click .fake_subreddit" : function() {
      $('header .title').click();
      $('header .search').focus();
    }
    //dont think i want this
    // "mouseleave header" : function() {
    //   $('.title').removeClass('open');
    //   $('body').stop().animate({'top' : "0"});
    // }
  });
  Template.body.onRendered(function() {
    reddit.refresh();

    this.autorun(function() {
      //autorun will refresh whenever dependencies change, so random variable :)
      var s = Session.get('subreddits');
      setTimeout(function() {
        var w = $(document).width()/$('#subreddits > .content')[0].scrollWidth*100;
        $('#smartbar .viewfinder').css({
          'width' : w  + "%"
        })
      },100); //cheapass way to make sure all processing has finished before making moves. lol
    });
    $(window).resize(function() {
      var w = $(document).width()/$('#subreddits > .content')[0].scrollWidth*100;
      $('#smartbar .viewfinder').css({
        'width' : w  + "%"
      })
    })
    //set current scroll position
    $('#subreddits').scrollLeft(Session.get('scrollLeft'))
    //changing the view finder
    $('#subreddits').scroll(function() {
      ss = $('#subreddits > .content')[0].scrollWidth;
      sl = $(this).scrollLeft();
      $('.viewfinder').css('left', sl/ss*100 + "%");

      //remember current page scroll position
      Session.setPersistent('scrollLeft',$(this).scrollLeft());
    });

    //edge pan
    $('#subreddits').on('mousemove', function(e) {
      $t = $(this);
      d = $t.width();
      if (e.pageX/d > .9) // right
        $t.scrollLeft($t.scrollLeft() + 8);
      else if (e.pageX/d < .1) //left
        $t.scrollLeft($t.scrollLeft() - 8);

    })

    //potentially horizontal scrolling..
    /*
      however it has many issues:
      - how to get horizontal scroll to detect when its inside a sub?
      - how to only get horizontal scroll to work when its not inside a sub.
      its very difficult to implement.
    */

  });

  //subreddit
  Template.subreddit.created = function() {
    this.dragged = new ReactiveVar(false);
  };

  Template.subreddit.helpers({
    id : function() {
      return this.id
    },
    title : function() {
      return this.title
    },
    color : function() {
      return this.color
    },
    post : function() {
      return this.post;
    },
    dragged : function() {
      return Template.instance().dragged.get();
    }
  })

  Template.subreddit.events({
    "click .link" : function (e) {
      if (Session.get('linkstate') == 1) {
        e.preventDefault();
        window.open(e.target.href, "_blank","toolbar=0");
      }else
      if (Session.get('linkstate') == 2) {
        e.preventDefault();
        window.open(e.target.href, "_blank");
      }else
      if (Session.get('linkstate') == 3) {
        return;
      }

    },
    "click .close-subreddit" : function() {
      var subs = Session.get('subreddits');
      for (var s in subs)
        if (subs[s].id == this.id)
          subs.splice(s,1);
      Session.setPersistent('subreddits',subs)
    },
    "mousedown .drag-subreddit" : function(e, t) {
      var t, diffY,diffX, $this, clone;
      $this = this;
      t.dragged.set(true);

      var s = t.find('.subreddit');

      //duplicate sub
      clone = $(s).clone().addClass('ghost').css({
        'top' : $(s).offset().top,
        'left' : $(s).offset().left
      }).appendTo(s);

      //make it follow cursor
      diffY = $(s).offset().top - e.pageY;
      diffX = $(s).offset().left - e.pageX;

      $('body').on("mousemove",function(e) {
        clone.css({
          'top' : diffY + e.pageY,
          'left' : diffX + e.pageX
        });
      });

      //make subreddits highlight
      $('.subreddit').on('mouseenter',function(e) {
        $(this).addClass("replace");
      });
      $('.subreddit').on('mouseleave',function(e) {
        $(this).removeClass("replace");
      })

      //quick fix
      $(s).addClass('replace');

      //remove it on mouseup and switch positions
      $('body').on('mouseup', function(e) {
        t.dragged.set(false);
        $(t.findAll('.ghost')).remove();
        var id,curr,orig,dest,tmp;
        id = Blaze.getData($('.subreddit.replace')[0]).id;
        curr = Session.get('subreddits');
        //find origin and destination of swapping subs
        for (var c in curr) {
          if (curr[c].id == $this.id)
            orig = c;
          if (curr[c].id == id)
            dest = c;
        }

        //action of swapping
        tmp = curr.splice(orig,1);
        curr.splice(dest,0,tmp[0]);

        //set it in stone
        Session.setPersistent('subreddits',curr);

        //unset unused stuff
        $('body').off("mousemove").off('mouseup');
        $('.subreddit').removeClass('replace').off('mouseenter').off('mouseleave');
      });
    }
  })


  //smartbar
  Template.smartbar.helpers({
    subreddits : function() {
      return Session.get('subreddits');
    },
    sublength : function() {
      return 100 / Session.get('subreddits').length;
    },
    viewlength : function() {

        return
    }
  });
  Template.smartbar.events({
  });
  Template.smartbar.rendered = function() {
    var holding, x;



    function movements(x) {
      //slide
      var d, perc, max, mod, ss, sl;
      d = $(document).width();
      mod = Session.get('subreddits').length;
      perc = x/d;
      max = $('#subreddits > .content')[0].scrollWidth - $('#subreddits')[0].clientWidth;
      console.log(max);
      $('#subreddits').stop().animate({scrollLeft : perc*(max+d) - d/2},100);
    }

    //get mouse position
    $('#smartbar').on('mousemove', function(e) { if ($(this).hasClass('dragging')) x = e.pageX; });

    //click event
    $('#smartbar').on('click', function(e) {
      movements(e.pageX);
    })
    //drag event
    $("#smartbar").on('mousedown',function() {
      $(this).addClass('dragging');
      if (holding)
        clearInterval(holding);

      //move interval
      holding = setInterval(function () {
        movements(x);
      },100);

      //release mouse
      $('body').on('mouseup',function() {
        clearInterval(holding);
        $('#smartbar').removeClass('dragging');
        $('body').off('mouseup');
      });
    })

    //adjust viewfinder size

  }

  Accounts.ui.config({
    requestPermissions: {
      reddit: ['read'],
    },
  });
}


if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
