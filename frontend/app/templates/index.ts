export const templates = {
  blank: {
    title: "Blank Doc",
    data: {
      ops: []
    },
  },
  meetingNotes: {
    title: "Meeting Notes",
    data: {
      ops: [
        {
          attributes: {
            size: "large",
          },
          insert: "MEETING NOTES",
        },
        {
          attributes: {
            align: "center",
          },
          insert: "\n",
        },
        {
          insert: "\nMeeting Title:\nDate:\nLocation:\n\n\nAttendees",
        },
        {
          attributes: {
            table: "row-gfcq",
          },
          insert: "\n",
        },
        {
          insert: "Signature",
        },
        {
          attributes: {
            table: "row-gfcq",
          },
          insert: "\n",
        },
        {
          attributes: {
            table: "row-z7mm",
          },
          insert: "\n\n",
        },
        {
          attributes: {
            table: "row-s0yq",
          },
          insert: "\n\n",
        },
        {
          attributes: {
            table: "row-nqve",
          },
          insert: "\n\n",
        },
        {
          insert: "\n\n",
        },
        {
          attributes: {
            underline: true,
            bold: true,
          },
          insert: "Agenda Items",
        },
        {
          insert: "\nItem",
        },
        {
          attributes: {
            table: "row-ddhs",
          },
          insert: "\n",
        },
        {
          insert: "Presenter",
        },
        {
          attributes: {
            table: "row-ddhs",
          },
          insert: "\n",
        },
        {
          insert: "Duration",
        },
        {
          attributes: {
            table: "row-ddhs",
          },
          insert: "\n",
        },
        {
          attributes: {
            table: "row-ng9o",
          },
          insert: "\n\n\n",
        },
        {
          attributes: {
            table: "row-zotw",
          },
          insert: "\n\n\n",
        },
        {
          attributes: {
            table: "row-k2m1",
          },
          insert: "\n\n\n",
        },
        {
          insert: "\n\n",
        },
      ],
    },
  },
  letter: {
    title: "Letter",
    data: {
      ops: [
        {
          attributes: {
            bold: true,
          },
          insert: "First Name Last Name",
        },
        {
          insert:
            "\n123 Your Street\nCity, State, Postal Code\nPhone Number\nEmail\n\nJanuary 1 20xx\n\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "Reader Name",
        },
        {
          insert:
            "\nTitle, Company\n456 Their Street\nTheir City, State, Postal Code\n\n\nDear Reader,\n\n",
        },
        {
          attributes: {
            background: "#ffffff",
            color: "#000000",
          },
          insert:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
        },
        {
          insert: "\n\n",
        },
        {
          attributes: {
            background: "#ffffff",
            color: "#000000",
          },
          insert:
            "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. ",
        },
        {
          insert: "\n\n",
        },
        {
          attributes: {
            background: "#ffffff",
            color: "#000000",
          },
          insert:
            "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?",
        },
        {
          insert: "\n\nSincerely,\n\n\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "First Name Last Name",
        },
        {
          insert: "\n\n\n",
        },
      ],
    },
  },
  resume: {
    title: "Resume",
    data: {
      ops: [
        {
          attributes: {
            size: "huge",
            bold: true,
          },
          insert: "Your Name",
        },
        {
          attributes: {
            align: "center",
          },
          insert: "\n",
        },
        {
          insert: "City, State | Email | Phone Number | in/yourlinkedin",
        },
        {
          attributes: {
            align: "center",
          },
          insert: "\n",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            size: "large",
            underline: true,
          },
          insert: "Professional Experience",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "Job 1",
        },
        {
          insert: "\nCompany Name\n",
        },
        {
          attributes: {
            size: "small",
          },
          insert: "Date - Date",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            background: "#ffffff",
            color: "#000000",
          },
          insert:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat",
        },
        {
          attributes: {
            list: "bullet",
          },
          insert: "\n",
        },
        {
          attributes: {
            background: "#ffffff",
            color: "#000000",
          },
          insert:
            "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum",
        },
        {
          attributes: {
            list: "bullet",
          },
          insert: "\n",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "Job 2",
        },
        {
          insert: "\nCompany Name\n",
        },
        {
          attributes: {
            size: "small",
          },
          insert: "Date - Date",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            background: "#ffffff",
            color: "#000000",
          },
          insert:
            "Perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo",
        },
        {
          attributes: {
            list: "bullet",
          },
          insert: "\n",
        },
        {
          attributes: {
            background: "#ffffff",
            color: "#000000",
          },
          insert:
            "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt",
        },
        {
          attributes: {
            list: "bullet",
          },
          insert: "\n",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            size: "large",
            underline: true,
          },
          insert: "Project Experience",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "Project 1",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            size: "small",
          },
          insert: "Date - Date",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            color: "#000000",
            background: "#ffffff",
          },
          insert:
            "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem",
        },
        {
          attributes: {
            list: "bullet",
          },
          insert: "\n",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "Project 2",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            size: "small",
          },
          insert: "Date - Date",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            background: "#ffffff",
            color: "#000000",
          },
          insert:
            "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur",
        },
        {
          attributes: {
            list: "bullet",
          },
          insert: "\n",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            size: "large",
            underline: true,
          },
          insert: "Education",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "School Name, Location",
        },
        {
          insert: " - ",
        },
        {
          attributes: {
            italic: true,
          },
          insert: "Degree",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            size: "small",
          },
          insert: "Date - Date",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            color: "#000000",
            background: "#ffffff",
          },
          insert:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam",
        },
        {
          attributes: {
            list: "bullet",
          },
          insert: "\n",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            size: "large",
            underline: true,
          },
          insert: "Skills",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "Soft Skills",
        },
        {
          insert: ": ",
        },
        {
          attributes: {
            color: "#000000",
            background: "#ffffff",
          },
          insert:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit, Lorem ipsum dolor sit amet, consectetur adipiscing elit",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "Technical Skills",
        },
        {
          insert: ": ",
        },
        {
          attributes: {
            color: "#000000",
            background: "#ffffff",
          },
          insert:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit, Lorem ipsum dolor sit amet, consectetur adipiscing elit",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "Languages",
        },
        {
          insert: ": ",
        },
        {
          attributes: {
            color: "#000000",
            background: "#ffffff",
          },
          insert:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit, Lorem ipsum dolor sit amet, consectetur adipiscing elit",
        },
        {
          insert: "\n",
        },
        {
          attributes: {
            bold: true,
          },
          insert: "Achievements",
        },
        {
          insert: ": ",
        },
        {
          attributes: {
            color: "#000000",
            background: "#ffffff",
          },
          insert:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit, Lorem ipsum dolor sit amet, consectetur adipiscing elit",
        },
        {
          insert: "\n",
        },
      ],
    },
  },
};
