/* NACS site-typology content ("Tipo sito"): the taxonomy siti.qmd renders as
 * a specimen list, and the vocabulary the sites map's legend/filters use.
 *
 * `type` keys match data/sites.json's own `properties.type` values exactly
 * (lowercase, as written by prep_sites.R) so the taxonomy list and the map
 * can filter each other without a translation table. `fam` keys match
 * prep_sites.R's classify() groupings one-for-one.
 *
 * Text in `descrizione`/`evidenza`/`legacy`/`fontiScritte` is transcribed from
 * "Tipo sito.docx" (the team's own classification method), lightly cleaned of
 * Word-table artifacts (superscript "m2" -> "m²", stray spaces before
 * punctuation) and of unfilled template placeholders ("xxx m²", "x e y m²").
 * `blurb` is new copy written for this page, not part of the source table.
 */
(function () {
  "use strict";

  var NON_DISP = null;   // "not yet documented" is a real state, not empty string

  window.NACS_SITE_FAMILIES = {
    sparso: {
      label: "Insediamento sparso", shape: "circle", token: "--fam-sparso",
      blurb: "Un'unica unità abitativa isolata nel podere: dalla capanna alla villa."
    },
    aggregato: {
      label: "Insediamento aggregato", shape: "square", token: "--fam-aggregato",
      blurb: "Più unità riunite in un abitato: dal villaggio aperto al castrum fortificato."
    },
    funeraria: {
      label: "Area funeraria", shape: "triangle-down", token: "--fam-funeraria",
      blurb: "Sepolture, singole o in necropoli, in superficie o scavate nel banco roccioso."
    },
    culto: {
      label: "Luogo di culto", shape: "diamond", token: "--fam-culto",
      blurb: "Spazi dedicati al sacro: dal tempio alla chiesa, dal sacello al monastero."
    },
    produttiva: {
      label: "Area produttiva", shape: "hexagon", token: "--fam-produttiva",
      blurb: "Lavorazione e stoccaggio: fornaci, torchi, silos, magazzini."
    },
    cava: {
      label: "Cava", shape: "triangle-up", token: "--fam-cava",
      blurb: "Estrazione di materiali lapidei dal banco roccioso."
    },
    frequentazione: {
      label: "Frequentazione", shape: "cross", token: "--fam-frequentazione",
      blurb: "Uso temporaneo o stagionale del territorio, senza presenza stabile."
    },
    altro: {
      label: "Altro", shape: "pentagon", token: "--fam-altro",
      blurb: "Masserie, approdi, strade: infrastrutture note perlopiù dalle fonti."
    },
    "non id.": {
      label: "Non identificato", shape: "ring", token: "--fam-nonid",
      blurb: "Evidenza registrata, in attesa di una classificazione funzionale."
    }
  };

  window.NACS_SITE_TYPES = [
    {
      type: "insediamento 1", fam: "sparso", rank: 1,
      name: "Insediamento sparso, tipo 1",
      blurb: "Una capanna, una casa: la più piccola unità abitativa che il survey riconosce.",
      descrizione: "Insediamento rurale di tipo sparso, di piccole dimensioni (da poche decine a un centinaio di m²), corrispondente a una singola unità abitativa, occupata in modo stabile o temporaneo/stagionale, del tutto priva o con minime ripartizioni interne in settori/vani, vocata allo sfruttamento/valorizzazione delle risorse territoriali locali.",
      evidenza: "Area a bassa densità di manufatti. Sporadici materiali collegabili al disfacimento di manufatti edilizi e coperture in materiale deperibile (mattoni crudi, concotto, intonaco con tracce di incannucciata) o in muratura e laterizi (elementi lapidei, spezzoni di laterizi, frammenti di malta); pochi frammenti di vasellame ceramico per la conservazione, la preparazione, il consumo di alimenti e derrate; eventuali indicatori di attività artigianali/produttive di ambito domestico (macine, pesi da telaio e fuseruole, scorie di metallo, scarti di lavorazione dell’osso).",
      legacy: "Pre-protostoria: capanna. Età daunia/ellenistica: capanna; casa. Età romana/tardoantica: capanna; casa; riparo. Età medievale: capanna; casa; riparo.",
      fontiScritte: "Età romana/tardoantica: non si dispone di dati. Età medievale: casa."
    },
    {
      type: "insediamento 2", fam: "sparso", rank: 2,
      name: "Insediamento sparso, tipo 2",
      blurb: "Casa e produzione insieme: più vani, più materiale, una piccola azienda agricola.",
      descrizione: "Insediamento rurale di tipo sparso, di medie dimensioni (200-400 m² circa), corrispondente a una unità abitativa e produttiva, occupata in modo stabile, articolata in più ripartizioni interne o vani a carattere sia polifunzionale, sia specializzato, e pertinenze esterne (cortili, aie etc.), principalmente vocata allo sfruttamento/valorizzazione delle risorse territoriali locali.",
      evidenza: "Area a media densità di manufatti. Significativa quantità di materiali collegabili al disfacimento di manufatti edilizi e coperture in materiale deperibile (mattoni crudi, concotto, intonaco con tracce di incannucciata) o in muratura e laterizi (elementi lapidei, spezzoni di laterizi, frammenti di malta); frammenti di vasellame per la conservazione, il trasporto, la preparazione, il consumo di alimenti e derrate; presenza di indicatori dello svolgimento di attività artigianali e/o produttive (grandi contenitori per lo stoccaggio, silos o fosse granarie, elementi di torchi/presse, frammenti di vasche con rivestimento, macine, scorie di metallo, scarti di ceramica e/o laterizi, pesi da telaio, fuseruole, utensili e attrezzi da lavoro).",
      legacy: "Età daunia/ellenistica: casa, fattoria. Età romana/tardoantica: fattoria. Età medievale: non si dispone di dati.",
      fontiScritte: "Età romana/tardoantica: non si dispone di dati. Età medievale: casa?"
    },
    {
      type: "insediamento 3", fam: "sparso", rank: 3,
      name: "Insediamento sparso, tipo 3",
      blurb: "Una villa: architettura di rappresentanza e indicatori evidenti di status elevato.",
      descrizione: "Insediamento rurale di tipo sparso, di grandi dimensioni (anche più di 1 ettaro), corrispondente a un complesso architettonico a carattere residenziale e di rappresentanza, occupato in modo stabile, con significativa articolazione planimetrica (più unità funzionali all’interno del medesimo corpo di fabbrica ma anche più corpi di fabbrica distinti ma a distanza ravvicinata l’uno dall’altro), organizzazione e specializzazione funzionale degli spazi. Possibile connessione a settori destinati alla produzione, allo stoccaggio della rendita fondiaria, all’artigianato e all’allevamento. Evidenti indicatori di elevato status sociale.",
      evidenza: "Vasta area a medio-alta densità di manufatti. Ingente presenza di materiali collegabili al disfacimento di manufatti edilizi in muratura, coperture in laterizi, apparati architettonici monumentali (trabeazioni, colonne), rivestimenti pavimentali (in particolare, cementizi, mosaici), rivestimenti parietali (intonaci, intonaci dipinti, lastre/lastrine marmoree), elementi decorativi e rivestimenti architettonici (antefisse, bassorilievi, fregi); assemblaggio ampio e variegato, per forme, produzioni rappresentate e provenienza degli esemplari, di vasellame in ceramica e vetro per la preparazione, la presentazione sulla mensa, il consumo, la conservazione, il trasporto di alimenti e derrate; attestazione di indicatori di attività artigianali e/o produttive (grandi contenitori per lo stoccaggio, macine, elementi di torchi/presse, frammenti di vasche con rivestimento, fosse granarie, scarti di ceramica e/o laterizi, pesi da telaio, fuseruole, utensili e attrezzi da lavoro etc.).",
      legacy: "Età romana e tardoantica: villa.",
      fontiScritte: "Età romana/tardoantica: non si dispone di dati. Età medievale: domus solaciorum; palatium."
    },
    {
      type: "insediamento 4", fam: "aggregato", rank: 4,
      name: "Insediamento aggregato, tipo 4",
      blurb: "Un piccolo villaggio aperto, senza forti differenze sociali visibili tra gli abitanti.",
      descrizione: "Insediamento rurale di tipo aggregato, di piccole dimensioni (entro i dieci ettari), generalmente privo di sistemi di difesa/fortificazione (aperto), costituito da poche unità abitative e produttive, eventualmente anche luoghi di culto e aree necropolari/cimiteriali, occupato in modo stabile o temporaneo/stagionale, prevalentemente vocato allo sfruttamento/valorizzazione delle risorse territoriali locali. L’organizzazione dell’insediamento non rivela significative differenze tra i profili sociali degli abitanti.",
      evidenza: "Concentrazioni multiple e ravvicinate a medio-alta densità di manufatti. Presenza di materiali collegabili al disfacimento di manufatti edilizi e coperture in materiale deperibile (mattoni crudi, concotto o intonaco con tracce di incannucciata) o in muratura e laterizi; frammenti di vasellame per la preparazione, il consumo, la conservazione, il trasporto di alimenti e derrate; attestazione di indicatori dello svolgimento di attività artigianali e/o produttive (grandi contenitori per lo stoccaggio, macine, elementi di torchi/presse, frammenti di vasche con rivestimento, fosse granarie, scarti di ceramica e/o laterizi, pesi da telaio, fuseruole, utensili e attrezzi da lavoro etc.).",
      legacy: "Età pre-protostorica: villaggio. Età daunia/ellenistica: villaggio. Età romana/tardoantica/medievale: villaggio.",
      fontiScritte: "Età romana/tardoantica: non si dispone di dati. Età medievale: casale; locus."
    },
    {
      type: "insediamento 5", fam: "aggregato", rank: 5,
      name: "Insediamento aggregato, tipo 5",
      blurb: "Un villaggio più grande, dove la cultura materiale comincia a segnalare differenze di rango.",
      descrizione: "Insediamento rurale di tipo aggregato, di grandi dimensioni (anche decine di ettari), generalmente privo di sistemi di difesa/fortificazione (aperto), costituito da più unità abitative e produttive, eventualmente anche luoghi di culto e aree necropolari/cimiteriali, occupato in modo stabile, vocato prevalentemente allo sfruttamento/valorizzazione delle risorse territoriali locali. In relazione alla facies culturale di riferimento, l’organizzazione dell’insediamento può rivelare differenze tra i profili sociali degli abitanti.",
      evidenza: "Concentrazioni multiple e ravvicinate a medio-alta densità di manufatti. Presenza di materiali collegabili al disfacimento di manufatti edilizi e coperture in materiale deperibile (mattoni crudi, concotto o intonaco con tracce di incannucciata) o in muratura e laterizi; frammenti di vasellame per la preparazione, il consumo, la conservazione, il trasporto di alimenti e derrate; attestazione di indicatori dello svolgimento di attività artigianali e/o produttive (grandi contenitori per lo stoccaggio, macine, elementi di torchi/presse, frammenti di vasche con rivestimento, fosse granarie, scarti di ceramica e/o laterizi, pesi da telaio, fuseruole, utensili e attrezzi da lavoro etc.). La presenza di élite o di compagini sociali di rango all’interno dell’abitato può essere segnalata da unità topografiche connotate da potenziali indicatori di status non ravvisabili altrove: una più consistente attestazione di materiali edilizi, un maggiore pregio dei materiali impiegati, un maggiore addensamento di contenitori o apprestamenti per lo stoccaggio, un repertorio più variegato di vasellame.",
      legacy: "Età pre-protostorica: villaggio; stazione. Età daunia/ellenistica: villaggio. Età romana/tardoantica: villaggio. Età medievale: casale; villaggio.",
      fontiScritte: "Età romana/tardoantica: non si dispone di dati. Età medievale: locus; casale; curtis."
    },
    {
      type: "insediamento 6", fam: "aggregato", rank: 6,
      name: "Insediamento aggregato, tipo 6",
      blurb: "Un abitato chiuso da fortificazioni: presidio del territorio, non solo residenza.",
      descrizione: "Insediamento rurale di tipo aggregato, di grandi dimensioni (anche decine di ettari), costituito da più unità abitative e produttive, eventualmente anche luoghi di culto e aree necropolari/cimiteriali, dotato di sistemi di delimitazione e/o fortificazione, occupato in modo stabile, vocato al presidio territoriale e allo sfruttamento/valorizzazione delle risorse locali. L’organizzazione dell’insediamento rivela differenze tra i profili sociali degli abitanti.",
      evidenza: "Area di estensione assai variabile, caratterizzata da una densità generalmente medio-bassa di manufatti. Variazioni micromorfologiche del piano di campagna possono segnalare fossati, terrapieni, aggeri, fortificazioni in terra o muratura sepolti. Assenza o presenza assai sporadica di materiali collegabili al disfacimento di manufatti edilizi; assemblaggio quantitativamente poco consistente di frammenti di vasellame ceramico, in prevalenza stoviglie acrome e prive di rivestimenti.",
      legacy: "Età pre-protostorica: villaggio fortificato. Età daunia/ellenistica: villaggio o agglomerato fortificato. Età romana/tardoantica: non si dispone di dati. Età medievale: casale, castrum.",
      fontiScritte: "Età romana/tardoantica: non si dispone di dati. Età medievale: casale, castrum."
    },
    {
      type: "frequentazione", fam: "frequentazione", rank: null,
      name: "Frequentazione",
      blurb: "Il territorio attraversato e usato, ma non abitato: nessuna infrastruttura permanente.",
      descrizione: "Porzione di territorio che ha conosciuto forme di utilizzo temporaneo e/o intermittente da parte di individui o comunità per scopi specifici, come attività economiche, rituali o stagionali, senza implicare una presenza stabile o la costruzione di infrastrutture permanenti.",
      evidenza: "Area di estensione assai variabile, caratterizzata da una densità altrettanto variabile di manufatti. Si possono riconoscere scarti di lavorazione, residui di fornaci, scorie di metallo, nuclei di pietra e schegge tipici della produzione di strumenti litici; residui di materie prime come argilla, minerali metallici grezzi o pietra lavorabile; frammenti di grandi contenitori per il trasporto o la conservazione di derrate; sedimenti anomali (macchie scure con cenere, carboni, resti organici bruciati); strumenti di lavoro come macine, torchi, pestelli.",
      legacy: NON_DISP,
      fontiScritte: NON_DISP
    },
    {
      type: "area produttiva-artigianale-stoccaggio", fam: "produttiva", rank: null,
      name: "Area produttiva, artigianale o di stoccaggio",
      blurb: "Dove si lavorava e si conservava: forni, fornaci, silos, magazzini.",
      descrizione: "Porzione di territorio organizzata, destinata alla pratica di specifiche attività economiche come la lavorazione di materie prime (metallurgia, produzione di materiali fittili, tessitura etc.) o l'immagazzinamento e la conservazione di risorse e derrate. Queste aree sono spesso caratterizzate dalla presenza di resti di infrastrutture funzionali, quali forni, fornaci, punti di fuoco, fosse, magazzini, strumenti di lavoro, o scarti di produzione, e possono riflettere sia un utilizzo permanente sia stagionale o episodico.",
      evidenza: "Area di estensione assai variabile e densità variabile di manufatti. Scarti di lavorazione, residui di fornaci, scorie di metallo, nuclei di pietra e schegge tipici della produzione di strumenti litici; residui di materie prime (argilla, minerali metallici grezzi, pietra lavorabile); frammenti di grandi contenitori per il trasporto e la conservazione di derrate liquide o granaglie; tracce di fosse o strutture leggere per l'immagazzinamento; sedimenti anomali; strumenti di lavoro (macine, torchi/presse, pestelli, utensili). L'associazione tra più evidenze permette di attribuire con maggiore precisione un uso produttivo, artigianale o di stoccaggio.",
      legacy: NON_DISP,
      fontiScritte: NON_DISP
    },
    {
      type: "area sepolcrale ipogea", fam: "funeraria", rank: null,
      name: "Area sepolcrale ipogea",
      blurb: "La necropoli sottoterra: camere, nicchie e arcosoli scavati nel banco roccioso.",
      descrizione: "Porzione di territorio organizzata al fine di accogliere deposizioni intenzionali e rituali di resti umani, all’interno di spazi ricavati al di sotto del livello del suolo, attraverso lo scavo nel banco roccioso di ambienti artificiali, dotati di nicchie, loculi, arcosoli. Tali spazi possono presentare anche un'architettura interna complessa.",
      evidenza: "Struttura/e ben conservata/e e ancora accessibile/i; presenza di irregolarità del terreno (avvallamenti o depressioni), che possono indicare il collasso parziale di camere o spazi vuoti sottostanti; resti visibili di ingressi originari, come pozzi verticali o aperture; in associazione, sporadici frammenti ceramici e/o ossa.",
      legacy: "Età pre-protostorica: ipogei. Età romana/tardoantica: ipogei.",
      fontiScritte: NON_DISP
    },
    {
      type: "area sepolcrale", fam: "funeraria", rank: null,
      name: "Area sepolcrale",
      blurb: "Sepolture in superficie, singole o plurime, con eventuali strutture accessorie.",
      descrizione: "Porzione di territorio organizzata al fine di accogliere deposizioni intenzionali e rituali di resti umani. Può comprendere diverse sepolture singole o plurime, realizzate con modalità e tecniche differenti; può includere strutture accessorie, come altari, cippi funerari, recinti.",
      evidenza: "Da completare: criteri di riconoscimento in superficie ancora da definire per questo tipo.",
      legacy: "Età pre-protostorica: necropoli. Età daunia/ellenistica: necropoli. Età romana: necropoli. Età tardoantica/medievale: cimitero.",
      fontiScritte: NON_DISP
    },
    {
      type: "massaria", fam: "altro", rank: null,
      name: "Massaria",
      blurb: "L'azienda rurale di età medievale: di campo, di allevamento, o mista.",
      descrizione: "Aziende rurali, piccole e grandi, con forme di proprietà e gestione ampiamente differenziate, che si distinguono in tre tipi: le masserie di campo (fondo coltivato o vera e propria azienda cerealicola, con abitazione colonica, depositi, strutture di produzione); le masserie di allevamento (riproduzione del bestiame, soprattutto ovicaprini e suini); le masserie miste (massariae animalium et camporum), dove attività agricole e pastorali si integrano.",
      evidenza: NON_DISP,
      legacy: NON_DISP,
      fontiScritte: "Età medievale: massaria."
    },
    {
      type: "approdo", fam: "altro", rank: null,
      name: "Approdo",
      blurb: "Un punto di attracco lungo la costa o un corso d'acqua.",
      descrizione: "Luogo lungo una costa, una riva o un corso d'acqua destinato all'attracco di imbarcazioni; dispone di strutture costruite per facilitare l'ormeggio e lo sbarco di persone e beni/materiali trasportati.",
      evidenza: NON_DISP,
      legacy: "Età daunia/ellenistica/romana/tardoantica/medievale: porto; approdo.",
      fontiScritte: "Età romana/medievale: portus."
    },
    {
      type: "cava", fam: "cava", rank: null,
      name: "Cava",
      blurb: "Estrazione di pietra: pareti tagliate, gradoni, blocchi abbandonati.",
      descrizione: "Sito di estrazione di materiali lapidei.",
      evidenza: "Pareti rocciose scavate in modo regolare, con tagli netti e lineari, solchi paralleli o incisioni che indicano l'estrazione di blocchi di forma quadrangolare; presenza di gradoni o terrazzamenti irregolari, creati per consentire l'accesso progressivo ai diversi livelli di materiale da estrarre; presenza di frammenti di scarti di lavorazione, di blocchi tagliati ma non estratti, di blocchi abbandonati.",
      legacy: NON_DISP,
      fontiScritte: NON_DISP
    },
    {
      type: "luogo di culto", fam: "culto", rank: null,
      name: "Luogo di culto",
      blurb: "Spazio sacro, costruito o naturale: dal sacello pagano alla chiesa.",
      descrizione: "Luogo fisico e simbolico, intenzionalmente modificato dall’uomo (spazio costruito) o preservato nelle sue fattezze naturali, dedicato all'espressione del sacro e allo svolgimento di pratiche religiose, rituali o spirituali volte a onorare divinità, entità soprannaturali, antenati o forze della natura.",
      evidenza: NON_DISP,
      legacy: "Età pre-protostorica: luogo di culto. Età daunia/ellenistica: luogo di culto; sacello. Età romana: tempio; sacello. Età tardoantica/medievale: chiesa.",
      fontiScritte: "Età romana/tardoantica: non si dispone di dati. Età medievale: ecclesia."
    },
    {
      type: "monastero", fam: "culto", rank: null,
      name: "Monastero",
      blurb: "Un complesso comunitario: chiesa, celle, chiostro, spazi di lavoro e di stoccaggio.",
      descrizione: "Complesso architettonico destinato alla vita comunitaria di monaci o monache. Generalmente comprende una chiesa, spazi residenziali individuali e collettivi (celle, chiostro, refettorio, etc.), spazi artigianali e settori deputati allo stoccaggio delle rendite e dei prodotti delle attività di sfruttamento/valorizzazione delle risorse territoriali locali.",
      evidenza: NON_DISP,
      legacy: "Età medievale: monastero.",
      fontiScritte: "Età medievale: monasterium."
    },
    {
      type: "strada", fam: "altro", rank: null,
      name: "Strada",
      blurb: "Un percorso viario storico, non un sito in senso proprio.",
      descrizione: "Tracciato viario storico documentato nel comprensorio d'indagine: non un sito puntuale, ma un elemento infrastrutturale del paesaggio che ne condiziona l'organizzazione insediativa.",
      evidenza: NON_DISP,
      legacy: NON_DISP,
      fontiScritte: NON_DISP
    },
    {
      type: "non id.", fam: "non id.", rank: null,
      name: "Non identificato",
      blurb: "Un'evidenza registrata sul campo che non rientra ancora in nessuna delle categorie correnti.",
      descrizione: "Sito rilevato sul campo o noto da fonti, la cui funzione non è ancora determinabile con le categorie attualmente in uso. Resta in tabella come promemoria, non come scarto: potrà essere riclassificato quando emergeranno elementi diagnostici sufficienti.",
      evidenza: NON_DISP,
      legacy: NON_DISP,
      fontiScritte: NON_DISP
    }
  ];
})();
