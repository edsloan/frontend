package model

import common.{Edition, ExecutionContexts, Logging}
import dfp.DfpAgent
import org.joda.time.DateTime
import play.api.libs.json.Json

case class Config(
                   id: String,
                   contentApiQuery: Option[String] = None,
                   displayName: Option[String] = None,
                   href: Option[String] = None,
                   groups: Seq[String],
                   collectionType: Option[String],
                   showTags: Boolean = false,
                   showSections: Boolean = false
                   ) {

  lazy val isSponsored: Boolean = DfpAgent.isSponsored(this)
  lazy val isAdvertisementFeature: Boolean = DfpAgent.isAdvertisementFeature(this)

  lazy val sponsorshipKeyword: Option[String] = DfpAgent.sponsorshipTag(this)
}

object Config {
  def apply(id: String): Config = Config(id, None, None, None, Nil, None)
  def apply(id: String, contentApiQuery: Option[String], displayName: Option[String], `type`: Option[String]): Config
    = Config(id, contentApiQuery, displayName, `type`, Nil, None)
  def apply (id: String, displayName: Option[String]): Config
    = Config(id, None, displayName, None, Nil, None)
  def apply (id: String, displayName: Option[String], href: Option[String]): Config
    = Config(id, None, displayName, href, Nil, None)

  val emptyConfig = Config("")
}

trait CollectionItems {
  def items: Seq[Content] = List()
}

case class Collection(curated: Seq[Content],
                      editorsPicks: Seq[Content],
                      mostViewed: Seq[Content],
                      results: Seq[Content],
                      displayName: Option[String],
                      href: Option[String],
                      lastUpdated: Option[String],
                      updatedBy: Option[String],
                      updatedEmail: Option[String]) extends implicits.Collections with CollectionItems {
  override lazy val items: Seq[Content] = (curated ++ editorsPicks ++ mostViewed ++ results).distinctBy(_.url)

  def isBackFillEmpty =
    (editorsPicks ++ mostViewed ++ results).isEmpty
}

object Collection {
  def apply(curated: Seq[Content]): Collection = Collection(curated, Nil, Nil, Nil, None, None, Option(DateTime.now.toString), None, None)
  def apply(curated: Seq[Content], displayName: Option[String]): Collection = Collection(curated, Nil, Nil, Nil, displayName, None, Option(DateTime.now.toString), None, None)
}
case class SeoDataJson(
  id: String,
  navSection: Option[String],
  webTitle: Option[String],   //Always short, eg, "Reviews" for "tone/reviews" id
  title: Option[String],      //Long custom title entered by editors
  description: Option[String])

case class SeoData(
  id: String,
  navSection: String,
  webTitle: String,
  title: Option[String],
  description: Option[String])

object SeoData extends ExecutionContexts with Logging {

  implicit val seoFormatter = Json.format[SeoData]

  val editions = Edition.all.map(_.id.toLowerCase)

  def fromPath(path: String): SeoData = path.split('/').toList match {
    //This case is only to handle the nonevent of uk/technology/games
    case edition :: section :: name :: tail if editions.contains(edition.toLowerCase) =>
      val webTitle: String = webTitleFromTail(name :: tail)
      SeoData(path, section, webTitle, None, descriptionFromWebTitle(webTitle))
    case edition :: name :: tail if editions.contains(edition.toLowerCase) =>
      val webTitle: String = webTitleFromTail(name :: tail)
      SeoData(path, name, webTitle, None, descriptionFromWebTitle(webTitle))
    case section :: name :: tail =>
      val webTitle: String = webTitleFromTail(name :: tail)
      SeoData(path, section, webTitle, None, descriptionFromWebTitle(webTitle))
    case oneWord :: tail =>
      val webTitleOnePart: String = webTitleFromTail(oneWord :: tail)
      SeoData(path, oneWord, webTitleOnePart, None, descriptionFromWebTitle(webTitleOnePart))
  }

  def webTitleFromTail(tail: List[String]): String = tail.flatMap(_.split('-')).flatMap(_.split('/')).map(_.capitalize).mkString(" ")

  def descriptionFromWebTitle(webTitle: String): Option[String] = Option(s"Latest $webTitle news, comment and analysis from the Guardian, the world's leading liberal voice")

  lazy val empty: SeoData = SeoData("", "", "", None, None)
}

case class FrontProperties(
  onPageDescription: Option[String],
  imageUrl: Option[String],
  imageWidth: Option[String],
  imageHeight: Option[String],
  isImageDisplayed: Boolean,
  editorialType: Option[String]
)

object FrontProperties{
  implicit val propsFormatter = Json.format[FrontProperties]
}

object FaciaComponentName {
  def apply(config: Config, collection: Collection): String = {
    config.displayName.orElse(collection.displayName).map { title =>
      title.toLowerCase.replace(" ", "-")
    }.getOrElse("no-name")
  }
}